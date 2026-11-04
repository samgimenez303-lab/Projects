jest.mock('../src/config/db', () => ({ pool: { execute: jest.fn() }, getConnection: jest.fn() }));

const { DatabaseSync } = require('node:sqlite');
const { pool, getConnection } = require('../src/config/db');
const { GameReminder, CANDIDATES_SQL } = require('../src/models/GameReminder');

const now = new Date('2026-11-03T23:00:00Z');
const timeZone = 'Asia/Manila';
const utcMarker = '2026-11-03 23:00:00';

describe('Durable game-reminder storage with an isolated SQL database', () => {
  let db, connection, events, failAt;

  const addBooking = (id = 7, overrides = {}) => {
    const booking = {
      userId: 1, date: '2026-11-04', start: '08:00:00', status: 'confirmed', ...overrides
    };
    db.prepare(`INSERT INTO reservations
      (id, reference_number, user_id, court_id, reservation_date, start_time, status)
      VALUES (?, ?, ?, 1, ?, ?, ?)`)
      .run(id, `PB-${id}`, booking.userId, booking.date, booking.start, booking.status);
  };
  const addJournal = (id = 7, overrides = {}) => {
    const record = {
      date: '2026-11-04', start: '08:00:00', notifiedAt: utcMarker, emailStatus: 'sent', ...overrides
    };
    db.prepare(`INSERT INTO reservation_reminders
      (reservation_id, reservation_date, start_time, notified_at, email_status)
      VALUES (?, ?, ?, ?, ?)`).run(id, record.date, record.start, record.notifiedAt, record.emailStatus);
  };
  const journal = () => db.prepare('SELECT * FROM reservation_reminders ORDER BY reservation_date, start_time').all().map(row => ({ ...row }));
  const notifications = () => db.prepare('SELECT * FROM notifications').all().map(row => ({ ...row }));

  // Only MySQL's upsert/row-lock syntax needs translation. The real candidate,
  // join, key, notification, status-update, and rollback behavior runs in SQL.
  const executeSql = async (sql, params = []) => {
    events.push(sql);
    if (failAt && sql.includes(failAt)) throw new Error('Injected storage failure');
    const compatible = sql.replace(/\s+FOR UPDATE\b/g, '')
      .replace(/ON DUPLICATE KEY UPDATE reservation_id = VALUES\(reservation_id\)/,
        'ON CONFLICT (reservation_id, reservation_date, start_time) DO NOTHING');
    const statement = db.prepare(compatible);
    return /^\s*SELECT\b/i.test(compatible) ? [statement.all(...params)] : [statement.run(...params)];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    events = []; failAt = '';
    db = new DatabaseSync(':memory:');
    db.function('UTC_TIMESTAMP', () => utcMarker);
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, is_active INTEGER, role TEXT);
      CREATE TABLE courts (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE reservations (
        id INTEGER PRIMARY KEY, reference_number TEXT, user_id INTEGER REFERENCES users(id),
        court_id INTEGER REFERENCES courts(id), reservation_date TEXT, start_time TEXT, status TEXT
      );
      CREATE TABLE reservation_reminders (
        reservation_id INTEGER REFERENCES reservations(id) ON DELETE CASCADE,
        reservation_date TEXT, start_time TEXT, notified_at TEXT DEFAULT NULL,
        email_status TEXT NOT NULL DEFAULT 'pending', email_attempted_at TEXT DEFAULT NULL,
        email_sent_at TEXT DEFAULT NULL, last_error_code TEXT DEFAULT NULL,
        PRIMARY KEY (reservation_id, reservation_date, start_time)
      );
      CREATE TABLE notifications (
        id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), title TEXT,
        message TEXT, type TEXT, is_read INTEGER, link TEXT
      );
      INSERT INTO users VALUES (1, 'Registered Player', 'player@example.test', 1, 'customer'),
        (2, 'Inactive Player', 'inactive@example.test', 0, 'customer'),
        (3, 'Staff Player', 'staff@example.test', 1, 'staff');
      INSERT INTO courts VALUES (1, 'Indoor Court');
    `);
    connection = {
      beginTransaction: jest.fn(async () => { events.push('begin'); db.exec('BEGIN'); }),
      execute: jest.fn(executeSql),
      commit: jest.fn(async () => {
        events.push('commit');
        if (failAt === 'commit') throw new Error('Injected commit failure');
        db.exec('COMMIT');
      }),
      rollback: jest.fn(async () => { events.push('rollback'); db.exec('ROLLBACK'); }),
      release: jest.fn(() => { events.push('release'); })
    };
    getConnection.mockResolvedValue(connection);
    pool.execute.mockImplementation(executeSql);
  });
  afterEach(() => { db.close(); });

  test('the actual candidate SQL excludes ineligible statuses, inactive accounts, guests, and other dates', async () => {
    addBooking(1);
    addBooking(2, { status: 'pending' });
    addBooking(3, { status: 'cancelled' });
    addBooking(4, { status: 'completed' });
    addBooking(5, { status: 'rejected' });
    addBooking(6, { userId: 2 });
    addBooking(7, { userId: null });
    addBooking(8, { date: '2026-11-03' });
    addBooking(9, { date: '2026-11-05' });
    addBooking(10, { userId: 3 });
    expect(db.prepare(CANDIDATES_SQL).all('2026-11-04', '2026-11-04').map(row => row.id)).toEqual([1, 10]);
    expect((await GameReminder.findCandidates(now, timeZone)).map(row => row.id)).toEqual([1, 10]);
  });

  test('candidates retain pending email or missing notification work, but omit completed delivery journals', async () => {
    for (let id = 1; id <= 5; id++) addBooking(id);
    addJournal(1, { emailStatus: 'sent' });
    addJournal(2, { emailStatus: 'failed' });
    addJournal(3, { emailStatus: 'pending' });
    addJournal(4, { emailStatus: 'sending', notifiedAt: null });
    expect((await GameReminder.findCandidates(now, timeZone)).map(row => row.id)).toEqual([3, 4, 5]);
  });

  test('locks the reservation first and commits its notification, durable marker, and email claim together', async () => {
    addBooking();
    const claim = await GameReminder.claim(7, now, timeZone);
    expect(claim).toMatchObject({
      key: [7, '2026-11-04', '08:00:00'], shouldEmail: true, notificationCreated: true,
      reservation: { id: 7, user_id: 1, user_email: 'player@example.test', court_name: 'Indoor Court' }
    });
    expect(notifications()).toEqual([expect.objectContaining({
      user_id: 1, title: 'Your game starts in 1 hour!', type: 'info', is_read: 0, link: '/reservations/7'
    })]);
    expect(journal()).toEqual([expect.objectContaining({
      notified_at: utcMarker, email_status: 'sending', email_attempted_at: utcMarker, email_sent_at: null
    })]);
    const reservationLock = events.findIndex(event => event.includes('FROM reservations') && event.includes('FOR UPDATE'));
    const journalLock = events.findIndex(event => event.includes('SELECT notified_at') && event.includes('FOR UPDATE'));
    const notificationInsert = events.findIndex(event => event.includes('INSERT INTO notifications'));
    const markNotified = events.findIndex(event => event.includes('SET notified_at'));
    const claimEmail = events.findIndex(event => event.includes("SET email_status = 'sending'"));
    expect(events[0]).toBe('begin');
    expect(reservationLock).toBeLessThan(journalLock);
    expect(journalLock).toBeLessThan(notificationInsert);
    expect(notificationInsert).toBeLessThan(markNotified);
    expect(markNotified).toBeLessThan(claimEmail);
    expect(claimEmail).toBeLessThan(events.indexOf('commit'));
    expect(events.at(-1)).toBe('release');
    expect(connection.rollback).not.toHaveBeenCalled();
  });

  test('a deleted notification cannot cause another notification or email for the same schedule', async () => {
    addBooking();
    const first = await GameReminder.claim(7, now, timeZone);
    await GameReminder.finishEmail(first.key, 'sent');
    db.exec('DELETE FROM notifications');
    const second = await GameReminder.claim(7, new Date(now.getTime() + 30000), timeZone);
    expect(second).toMatchObject({ shouldEmail: false, notificationCreated: false });
    expect(notifications()).toEqual([]);
    expect(journal()).toHaveLength(1);
    expect(journal()[0]).toMatchObject({ notified_at: utcMarker, email_status: 'sent', email_sent_at: utcMarker });
    expect(await GameReminder.findCandidates(now, timeZone)).toEqual([]);
  });

  test('a rescheduled booking gets a separate journal without erasing the old schedule delivery marker', async () => {
    addBooking();
    addJournal();
    db.exec("UPDATE reservations SET start_time = '07:45:00' WHERE id = 7");
    expect((await GameReminder.findCandidates(now, timeZone)).map(row => row.id)).toEqual([7]);
    const claim = await GameReminder.claim(7, now, timeZone);
    expect(claim).toMatchObject({ key: [7, '2026-11-04', '07:45:00'], shouldEmail: true, notificationCreated: true });
    expect(journal()).toEqual([
      expect.objectContaining({ start_time: '07:45:00', email_status: 'sending' }),
      expect.objectContaining({ start_time: '08:00:00', email_status: 'sent', notified_at: utcMarker })
    ]);
    expect(notifications()[0].title).toBe('Your game starts in 45 minutes!');
  });

  test.each(['sending', 'failed', 'sent', 'simulated', 'unconfirmed'])('never reclaims an email already marked %s', async (emailStatus) => {
    addBooking(); addJournal(7, { emailStatus });
    const claim = await GameReminder.claim(7, now, timeZone);
    expect(claim).toMatchObject({ shouldEmail: false, notificationCreated: false });
    expect(journal()[0].email_status).toBe(emailStatus);
    expect(notifications()).toEqual([]);
    expect(connection.execute.mock.calls.some(([sql]) => sql.includes("SET email_status = 'sending'"))).toBe(false);
  });

  test('repairs a missing notification marker without retrying an already attempted email', async () => {
    addBooking(); addJournal(7, { notifiedAt: null, emailStatus: 'unconfirmed' });
    const claim = await GameReminder.claim(7, now, timeZone);
    expect(claim).toMatchObject({ shouldEmail: false, notificationCreated: true });
    expect(notifications()).toHaveLength(1);
    expect(journal()[0]).toMatchObject({ notified_at: utcMarker, email_status: 'unconfirmed' });
  });

  test('claims a pending email without recreating its existing notification', async () => {
    addBooking(); addJournal(7, { emailStatus: 'pending' });
    const claim = await GameReminder.claim(7, now, timeZone);
    expect(claim).toMatchObject({ shouldEmail: true, notificationCreated: false });
    expect(notifications()).toEqual([]);
    expect(journal()[0]).toMatchObject({ notified_at: utcMarker, email_status: 'sending' });
  });

  test.each([
    ['pending', { status: 'pending' }], ['cancelled', { status: 'cancelled' }],
    ['completed', { status: 'completed' }], ['rejected', { status: 'rejected' }],
    ['already started', { start: '07:00:00' }], ['past', { start: '06:59:00' }],
    ['more than an hour away', { start: '08:00:01' }], ['inactive account', { userId: 2 }],
    ['walk-in guest', { userId: null }]
  ])('does not create any delivery work for a booking that is %s', async (_, overrides) => {
    addBooking(7, overrides);
    await expect(GameReminder.claim(7, now, timeZone)).resolves.toBeNull();
    expect(journal()).toEqual([]);
    expect(notifications()).toEqual([]);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test.each(['INSERT INTO notifications', 'SET notified_at', "SET email_status = 'sending'", 'commit'])('rolls back all reminder work if %s fails', async (failure) => {
    addBooking(); failAt = failure;
    await expect(GameReminder.claim(7, now, timeZone)).rejects.toThrow('Injected');
    expect(journal()).toEqual([]);
    expect(notifications()).toEqual([]);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
    failAt = '';
    await expect(GameReminder.claim(7, now, timeZone)).resolves.toMatchObject({ shouldEmail: true, notificationCreated: true });
  });

  test.each([
    "UPDATE users SET is_active = 0 WHERE id = 1",
    "UPDATE reservations SET status = 'cancelled' WHERE id = 7",
    "UPDATE reservations SET start_time = '08:30:00' WHERE id = 7"
  ])('rechecks the active account and original schedule before sending (%s)', async (change) => {
    addBooking();
    const claim = await GameReminder.claim(7, now, timeZone);
    db.exec(change);
    await expect(GameReminder.currentReservation(claim, now, timeZone)).resolves.toBeNull();
  });

  test('only finishes an existing sending claim and preserves its completed outcome against a stale result', async () => {
    addBooking();
    const claim = await GameReminder.claim(7, now, timeZone);
    await GameReminder.finishEmail(claim.key, 'sent');
    await GameReminder.finishEmail(claim.key, 'failed', 'LATE_RESULT');
    expect(journal()[0]).toMatchObject({ email_status: 'sent', email_sent_at: utcMarker, last_error_code: null });
    await expect(GameReminder.finishEmail(claim.key, 'pending')).rejects.toThrow('Invalid reminder email status');
  });
});
