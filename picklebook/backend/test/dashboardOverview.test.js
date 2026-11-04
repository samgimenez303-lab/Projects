jest.mock('../src/config/db', () => ({ pool: { execute: jest.fn() } }));

const { DatabaseSync } = require('node:sqlite');
const {
  resolveOverviewPeriod, summarizeCourtFinance,
  MONTHLY_COURT_FINANCE_SQL, ATTENTION_SQL, PAYMENT_QUEUE_SQL, TODAY_SCHEDULE_SQL
} = require('../src/utils/dashboardOverview');

describe('Facility-local overview month boundaries', () => {
  beforeEach(() => { jest.useFakeTimers().setSystemTime(new Date('2026-10-31T17:00:00Z')); });
  afterEach(() => { jest.useRealTimers(); });

  test('default month and today follow the facility timezone across a UTC month boundary', () => {
    expect(resolveOverviewPeriod(undefined, 'Asia/Manila')).toEqual({
      month: '2026-11', time_zone: 'Asia/Manila', today: '2026-11-01', start_date: '2026-11-01', end_date: '2026-11-30'
    });
    expect(resolveOverviewPeriod(undefined, 'America/Los_Angeles').month).toBe('2026-10');
  });

  test('uses exact calendar endpoints, including leap years and the supported last year', () => {
    expect(resolveOverviewPeriod('2028-02', 'UTC')).toMatchObject({ start_date: '2028-02-01', end_date: '2028-02-29' });
    expect(resolveOverviewPeriod('2027-02', 'UTC').end_date).toBe('2027-02-28');
    expect(resolveOverviewPeriod('9999-12', 'UTC').end_date).toBe('9999-12-31');
  });

  test.each(['2026-00', '2026-13', '2026-1', '2026-10-01', '0000-01', '', ['2026-10'], { month: '2026-10' }, '2026-10\' OR 1=1'])('rejects invalid month input %p', (month) => {
    expect(() => resolveOverviewPeriod(month, 'UTC')).toThrow('YYYY-MM');
  });
});

describe('Overview SQL accounting with isolated in-memory data', () => {
  let db;
  const insertBooking = (id, court, date, status, total, hours = 1, start = '08:00:00') => {
    db.prepare('INSERT INTO reservations (id, reference_number, user_id, court_id, reservation_date, start_time, end_time, status, total_price, duration_hours) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, `PB-${id}`, court, date, start, '10:00:00', status, total, hours);
  };
  const insertPayment = (id, reservation, status, amount, method = 'cash') => {
    db.prepare('INSERT INTO payments VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, reservation, amount, method, status, method === 'gcash' ? `GCASH-${id}` : null, '2026-10-01 08:00:00');
  };
  const monthRows = () => db.prepare(MONTHLY_COURT_FINANCE_SQL)
    .all('2026-10-01', '2026-10-31', '2026-10-01', '2026-10-31');

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.function('LEAST', { varargs: true }, (...values) => Math.min(...values));
    db.function('GREATEST', { varargs: true }, (...values) => Math.max(...values));
    db.exec(`
      CREATE TABLE courts (id INTEGER PRIMARY KEY, name TEXT, sort_order INTEGER);
      CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT);
      CREATE TABLE reservations (id INTEGER PRIMARY KEY, reference_number TEXT, user_id INTEGER, court_id INTEGER,
        reservation_date TEXT, start_time TEXT, end_time TEXT, status TEXT, total_price NUMERIC, duration_hours NUMERIC, walk_in_name TEXT);
      CREATE TABLE payments (id INTEGER PRIMARY KEY, reservation_id INTEGER, amount NUMERIC, payment_method TEXT,
        payment_status TEXT, transaction_reference TEXT, created_at TEXT);
      CREATE TABLE payment_verifications (id INTEGER PRIMARY KEY, payment_id INTEGER, action TEXT);
      CREATE TABLE contact_inquiries (id INTEGER PRIMARY KEY, status TEXT);
      INSERT INTO courts VALUES (1, 'Indoor Court', 1), (2, 'Outdoor Court', 2), (3, 'Quiet Court', 3);
      INSERT INTO users VALUES (1, 'Test Player', 'player@example.test');
      INSERT INTO contact_inquiries VALUES (1, 'new'), (2, 'new'), (3, 'read');
    `);
    insertBooking(1, 1, '2026-10-01', 'confirmed', 1000, 2);
    insertPayment(1, 1, 'verified', 400);
    db.exec("INSERT INTO payment_verifications VALUES (1, 1, 'verified'), (2, 1, 'verified'), (3, 1, 'rejected')");
    insertBooking(2, 2, '2026-10-31', 'completed', 700);
    insertPayment(2, 2, 'verified', 1000);
    insertBooking(3, 1, '2026-10-15', 'pending', 500);
    insertPayment(3, 3, 'verified', 500);
    insertBooking(4, 1, '2026-10-31', 'cancelled', 900);
    insertPayment(4, 4, 'verified', 900);
    insertBooking(5, 1, '2026-10-31', 'rejected', 900);
    insertPayment(5, 5, 'submitted', 900, 'gcash');
    insertBooking(6, 1, '2026-09-30', 'confirmed', 400);
    insertPayment(6, 6, 'verified', 400);
    insertBooking(7, 1, '2026-11-01', 'confirmed', 800);
    insertPayment(7, 7, 'verified', 800);
    insertBooking(8, 2, '2026-10-15', 'confirmed', 300);
    insertPayment(8, 8, 'refunded', 300);
    insertBooking(9, 2, '2026-10-15', 'confirmed', 1000, 2);
    insertPayment(9, 9, 'verified', 300);
    insertPayment(10, 9, 'verified', 200);
    insertBooking(10, 1, '2026-10-15', 'confirmed', 600);
    insertPayment(11, 10, 'pending', 600);
    insertBooking(11, 2, '2026-10-31', 'pending', 200);
    insertPayment(12, 11, 'submitted', 200, 'gcash');
    insertBooking(12, 2, '2026-10-15', 'confirmed', 700);
    insertPayment(13, 12, 'pending', 700, 'gcash');
    insertBooking(13, 2, '2026-10-15', 'confirmed', 300);
    insertPayment(14, 13, 'verified', 300);
    insertPayment(15, 13, 'pending', 300);
    insertBooking(14, 1, '2026-10-31', 'confirmed', 100, 1, '09:00:00');
    insertPayment(16, 14, 'verified', 150);
  });
  afterEach(() => { db.close(); });

  test('uses stored booking totals, caps per-booking verified income and keeps pending approvals separate', () => {
    const summary = summarizeCourtFinance(monthRows());
    expect(summary.finance).toEqual({
      expected_income: 4700, verified_income: 2000, outstanding_income: 2700,
      pending_approval_value: 700, confirmed_bookings: 8, pending_approval_bookings: 2
    });
    expect(summary.court_activity).toContainEqual({ court_id: 1, court_name: 'Indoor Court', booking_count: 3, booked_hours: 4, expected_income: 1700 });
    expect(summary.court_activity).toContainEqual({ court_id: 2, court_name: 'Outdoor Court', booking_count: 5, booked_hours: 6, expected_income: 3000 });
    expect(summary.court_activity).toContainEqual({ court_id: 3, court_name: 'Quiet Court', booking_count: 0, booked_hours: 0, expected_income: 0 });
  });

  test('cancelled/rejected bookings, refunds and duplicate verification history never inflate monthly income', () => {
    const before = summarizeCourtFinance(monthRows()).finance;
    db.exec("INSERT INTO payment_verifications VALUES (4, 1, 'verified'), (5, 1, 'verified')");
    insertBooking(15, 2, '2026-10-31', 'cancelled', 10000);
    insertPayment(17, 15, 'verified', 10000);
    expect(summarizeCourtFinance(monthRows()).finance).toEqual(before);
    db.exec("UPDATE payments SET payment_status = 'refunded' WHERE id = 1");
    expect(summarizeCourtFinance(monthRows()).finance).toMatchObject({ verified_income: 1600, outstanding_income: 3100 });
  });

  test('includes first/last month dates but excludes adjacent dates exactly', () => {
    const baseline = summarizeCourtFinance(monthRows()).finance;
    db.exec("UPDATE reservations SET total_price = 99999 WHERE id IN (6, 7)");
    expect(summarizeCourtFinance(monthRows()).finance).toEqual(baseline);
    db.exec("UPDATE reservations SET status = 'cancelled' WHERE id IN (1, 2)");
    expect(summarizeCourtFinance(monthRows()).finance.expected_income).toBe(3000);
  });

  test('returns only current actionable payment work and matching counts', () => {
    expect({ ...db.prepare(ATTENTION_SQL).get() }).toEqual({
      payment_verifications: 1, cash_collections: 1, pending_reservations: 2, new_inquiries: 2
    });
    const queue = db.prepare(PAYMENT_QUEUE_SQL).all();
    expect(queue.map((row) => row.id)).toEqual([12, 11]);
    expect(queue[0]).toMatchObject({ reservation_status: 'pending', user_name: 'Test Player', court_name: 'Outdoor Court', reference_number: 'PB-11' });
    expect(queue.some((row) => row.payment_status === 'pending' && row.payment_method === 'gcash')).toBe(false);
    expect(queue.some((row) => ['cancelled', 'rejected', 'completed'].includes(row.reservation_status))).toBe(false);
  });

  test('caps payment work at six and the active daily schedule at eight', () => {
    for (let index = 20; index < 32; index++) {
      insertBooking(index, 1, '2026-10-31', 'confirmed', 100);
      insertPayment(index + 20, index, 'pending', 100);
    }
    const queue = db.prepare(PAYMENT_QUEUE_SQL).all();
    const schedule = db.prepare(TODAY_SCHEDULE_SQL).all('2026-10-31');
    expect(queue).toHaveLength(6);
    expect(queue[0].payment_status).toBe('submitted');
    expect(schedule).toHaveLength(8);
    expect(schedule.every((row) => ['pending', 'confirmed', 'completed'].includes(row.status))).toBe(true);
    expect(schedule.some((row) => row.status === 'completed')).toBe(true);
  });

  test('paid walk-in bookings remain in schedule and verified monthly income without a user account', () => {
    const before = summarizeCourtFinance(monthRows()).finance;
    db.prepare('INSERT INTO reservations (id, reference_number, user_id, court_id, reservation_date, start_time, end_time, status, total_price, duration_hours, walk_in_name) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(80, 'PB-WALKIN', 1, '2026-10-31', '10:17:00', '11:17:00', 'completed', 800, 1, 'Counter Customer');
    insertPayment(80, 80, 'verified', 800);
    expect(summarizeCourtFinance(monthRows()).finance).toMatchObject({ expected_income: before.expected_income + 800, verified_income: before.verified_income + 800, outstanding_income: before.outstanding_income, confirmed_bookings: before.confirmed_bookings + 1 });
    expect(db.prepare(TODAY_SCHEDULE_SQL).all('2026-10-31')).toContainEqual(expect.objectContaining({ id: 80, user_name: 'Counter Customer', status: 'completed' }));
  });

  test('guest names are retained in actionable payment lookups through the nullable account join', () => {
    db.prepare('INSERT INTO reservations (id, reference_number, user_id, court_id, reservation_date, start_time, end_time, status, total_price, duration_hours, walk_in_name) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(81, 'PB-GUEST-DUE', 1, '2026-10-31', '11:00:00', '12:00:00', 'confirmed', 800, 1, 'Guest Customer');
    insertPayment(81, 81, 'pending', 800);
    expect(db.prepare(PAYMENT_QUEUE_SQL).all()).toContainEqual(expect.objectContaining({ id: 81, user_name: 'Guest Customer', user_email: null, amount: 800 }));
  });
});
