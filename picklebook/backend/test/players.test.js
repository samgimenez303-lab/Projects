jest.mock('../src/config/db', () => ({ pool: { execute: jest.fn(), getConnection: jest.fn() } }));

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../src/config/db');
const routes = require('../src/routes/players');
const { serializePlayer, timerTransition } = require('../src/utils/playerTimer');

const app = express();
app.use(express.json());
app.use('/api/players', routes);

describe('Shared walk-in player API', () => {
  const previousSecret = process.env.JWT_SECRET;
  let role;
  let token;
  let players;
  let now;
  let transactionBackup;
  let connection;
  const player = (values = {}) => ({
    id: 1, name: 'Alex', second_name: 'Sam', third_name: null, fourth_name: null, duration_seconds: 3600, remaining_seconds: 3600,
    timer_started_at: null, status: 'waiting', is_active: 1, ...values
  });
  const authorized = (operation) => operation.set('Authorization', `Bearer ${token}`);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'walk-in-players-test-only';
    now = 1793491200000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    role = 'staff';
    token = jwt.sign({ id: 4 }, process.env.JWT_SECRET);
    players = [];
    connection = {
      beginTransaction: jest.fn(async () => { transactionBackup = players.map((row) => ({ ...row })); }),
      commit: jest.fn(async () => {}),
      rollback: jest.fn(async () => { players = transactionBackup; }),
      release: jest.fn(),
      execute: jest.fn(async (sql, args) => {
        if (sql.startsWith('SELECT')) {
          return [players.filter((row) => row.id === args[0] && row.is_active).map((row) => ({ ...row }))];
        }
        const row = players.find((value) => value.id === args[args.length - 1] && value.is_active);
        if (!row) return [{ affectedRows: 0 }];
        if (sql.includes('SET name =')) [row.name, row.second_name, row.third_name, row.fourth_name] = args;
        else if (sql.includes('SET is_active =')) row.is_active = 0;
        else {
          [row.duration_seconds, row.remaining_seconds, row.timer_started_at, row.status] = args;
        }
        return [{ affectedRows: 1 }];
      })
    };
    pool.getConnection.mockResolvedValue(connection);
    pool.execute.mockImplementation(async (sql, args) => {
      if (sql.includes('FROM users WHERE id')) return [[{ id: 4, name: 'Desk Operator', role, is_active: 1 }]];
      if (sql.startsWith('SELECT') && sql.includes('FROM walk_in_players')) {
        return [players.filter((row) => row.is_active).map((row) => ({ ...row }))];
      }
      if (sql.startsWith('INSERT INTO walk_in_players')) {
        const id = players.length + 1;
        players.push(player({ id, name: args[0], second_name: args[1], third_name: args[2], fourth_name: args[3], duration_seconds: args[4], remaining_seconds: args[5], created_by: args[6] }));
        return [{ insertId: id }];
      }
      throw new Error('Unexpected query in isolated player test.');
    });
  });
  afterEach(() => { jest.restoreAllMocks(); });
  afterAll(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  test.each([
    ['get', '/api/players'], ['post', '/api/players'], ['patch', '/api/players/1'],
    ['delete', '/api/players/1'], ['post', '/api/players/1/timer']
  ])('%s %s requires authentication', async (method, path) => {
    const response = await request(app)[method](path).send({ name: 'Alex', action: 'start' });
    expect(response.status).toBe(401);
    expect(pool.execute).not.toHaveBeenCalled();
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test.each([
    ['get', '/api/players'], ['post', '/api/players'], ['patch', '/api/players/1'],
    ['delete', '/api/players/1'], ['post', '/api/players/1/timer']
  ])('%s %s denies customers before touching players', async (method, path) => {
    role = 'customer';
    const response = await authorized(request(app)[method](path).send({ name: 'Alex', action: 'start' }));
    expect(response.status).toBe(403);
    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test.each(['admin', 'staff'])('%s can add two trimmed names sharing a timer without booking or player accounts', async (operatorRole) => {
    role = operatorRole;
    const response = await authorized(request(app).post('/api/players').send({ name: '  Jo O\'Neil  ', second_name: '  Sam Lee  ', duration_minutes: 25 }));
    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({
      server_now: now,
      player: { id: 1, name: "Jo O'Neil", second_name: 'Sam Lee', third_name: null, fourth_name: null, duration_seconds: 1500, remaining_seconds: 1500, timer_started_at: null, status: 'waiting' }
    });
    expect(pool.execute).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO walk_in_players'), ["Jo O'Neil", 'Sam Lee', null, null, 1500, 1500, 4]
    );
    const listed = await authorized(request(app).get('/api/players'));
    expect(listed.body.data.players).toEqual([response.body.data.player]);
  });

  test('defaults new timers to 60 minutes', async () => {
    const response = await authorized(request(app).post('/api/players').send({ name: 'Alex', second_name: 'Sam' }));
    expect(response.status).toBe(201);
    expect(response.body.data.player.duration_seconds).toBe(3600);
  });

  test.each([
    { third_name: '  Casey  ', fourth_name: undefined, third: 'Casey', fourth: null },
    { third_name: '  Casey  ', fourth_name: '  Taylor  ', third: 'Casey', fourth: 'Taylor' },
    { third_name: '   ', fourth_name: '', third: null, fourth: null }
  ])('creates two to four contiguous trimmed names sharing one timer: %p', async ({ third_name, fourth_name, third, fourth }) => {
    const response = await authorized(request(app).post('/api/players').send({ name: 'Alex', second_name: 'Sam', third_name, fourth_name, duration_minutes: 30 }));
    expect(response.status).toBe(201);
    expect(response.body.data.player).toMatchObject({ name: 'Alex', second_name: 'Sam', third_name: third, fourth_name: fourth, duration_seconds: 1800, remaining_seconds: 1800 });
    expect(pool.execute).toHaveBeenLastCalledWith(expect.stringContaining('INSERT INTO walk_in_players'), ['Alex', 'Sam', third, fourth, 1800, 1800, 4]);
    const listed = await authorized(request(app).get('/api/players'));
    expect(listed.body.data.players).toEqual([response.body.data.player]);
  });

  test.each([
    { third_name: 3 }, { third_name: ['Casey'] }, { third_name: true }, { third_name: 'x'.repeat(101) },
    { third_name: 'Casey', fourth_name: 4 }, { third_name: 'Casey', fourth_name: ['Taylor'] },
    { third_name: 'Casey', fourth_name: 'x'.repeat(101) }, { fourth_name: 'Taylor' },
    { third_name: ' ', fourth_name: 'Taylor' }, { fifth_name: 'Extra' }, { sixth_name: 'Extra' },
    { players: ['Alex', 'Sam', 'Casey', 'Taylor', 'Extra'] }, { names: ['Alex', 'Sam'] }
  ])('rejects invalid or excessive roster fields without writes: %p', async (roster) => {
    const response = await authorized(request(app).post('/api/players').send({ name: 'Alex', second_name: 'Sam', ...roster }));
    expect(response.status).toBe(400);
    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test.each([undefined, null, '', '   ', 2, ['Alex'], 'x'.repeat(101)])('rejects invalid name %p', async (name) => {
    const response = await authorized(request(app).post('/api/players').send({ name, second_name: 'Sam' }));
    expect(response.status).toBe(400);
    expect(pool.execute).toHaveBeenCalledTimes(1);
  });

  test.each([undefined, null, '', '   ', 2, ['Sam'], 'x'.repeat(101)])('requires a valid second name %p before adding a session', async (second_name) => {
    const response = await authorized(request(app).post('/api/players').send({ name: 'Alex', second_name }));
    expect(response.status).toBe(400);
    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test('two different players may have the same name', async () => {
    const response = await authorized(request(app).post('/api/players').send({ name: 'Sam', second_name: 'Sam' }));
    expect(response.status).toBe(201);
    expect(response.body.data.player).toMatchObject({ name: 'Sam', second_name: 'Sam' });
  });

  test.each([null, 0, -1, 721, 1.5, '60', true])('rejects invalid timer duration %p', async (duration_minutes) => {
    const response = await authorized(request(app).post('/api/players').send({ name: 'Alex', second_name: 'Sam', duration_minutes }));
    expect(response.status).toBe(400);
    expect(pool.execute).toHaveBeenCalledTimes(1);
  });

  test('list preserves running anchors and projects expired timers without database writes', async () => {
    players = [
      player({ status: 'running', timer_started_at: now - 10000 }),
      player({ id: 2, remaining_seconds: 60, status: 'running', timer_started_at: now - 60000 }),
      player({ id: 3, is_active: 0 })
    ];
    const response = await authorized(request(app).get('/api/players'));
    expect(response.status).toBe(200);
    expect(response.body.data.server_now).toBe(now);
    expect(response.body.data.players).toHaveLength(2);
    expect(response.body.data.players[0]).toMatchObject({ remaining_seconds: 3600, timer_started_at: now - 10000, status: 'running' });
    expect(response.body.data.players[1]).toMatchObject({ remaining_seconds: 0, timer_started_at: null, status: 'finished' });
    expect(pool.getConnection).not.toHaveBeenCalled();
    expect(players[1].status).toBe('running');
  });

  test('both names are renamed together while preserving shared timer state', async () => {
    players = [player({ status: 'paused', remaining_seconds: 300 })];
    const response = await authorized(request(app).patch('/api/players/1').send({ name: '  Samantha  ', second_name: '  Taylor  ' }));
    expect(response.status).toBe(200);
    expect(response.body.data.player).toMatchObject({ name: 'Samantha', second_name: 'Taylor', remaining_seconds: 300, status: 'paused' });
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), [1]);
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining('SET name = ?, second_name = ?, third_name = ?, fourth_name = ?'), ['Samantha', 'Taylor', null, null, 1]);
    expect(players[0].name).toBe('Samantha');
    expect(players[0].second_name).toBe('Taylor');
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test('editing all four names preserves the running shared timer and optional names through pause', async () => {
    players = [player({ status: 'running', remaining_seconds: 300, timer_started_at: now - 1250 })];
    let response = await authorized(request(app).patch('/api/players/1').send({ name: 'Alex A', second_name: 'Sam B', third_name: ' Casey C ', fourth_name: ' Taylor D ' }));
    expect(response.status).toBe(200);
    expect(response.body.data.player).toMatchObject({ name: 'Alex A', second_name: 'Sam B', third_name: 'Casey C', fourth_name: 'Taylor D', remaining_seconds: 300, timer_started_at: now - 1250, status: 'running' });
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining('SET name = ?'), ['Alex A', 'Sam B', 'Casey C', 'Taylor D', 1]);
    response = await authorized(request(app).post('/api/players/1/timer').send({ action: 'pause' }));
    expect(response.status).toBe(200);
    expect(response.body.data.player).toMatchObject({ third_name: 'Casey C', fourth_name: 'Taylor D', remaining_seconds: 298.75, status: 'paused' });
  });

  test('a full roster edit back to two players clears optional names without changing the timer', async () => {
    players = [player({ third_name: 'Casey', fourth_name: 'Taylor', status: 'paused', remaining_seconds: 123.5 })];
    const response = await authorized(request(app).patch('/api/players/1').send({ name: 'Alex', second_name: 'Sam' }));
    expect(response.status).toBe(200);
    expect(response.body.data.player).toMatchObject({ third_name: null, fourth_name: null, remaining_seconds: 123.5, status: 'paused' });
    expect(players[0]).toMatchObject({ third_name: null, fourth_name: null });
  });

  test.each([
    { third_name: ['Casey'] }, { third_name: 'x'.repeat(101) }, { fourth_name: 'Taylor' },
    { third_name: 'Casey', fourth_name: 4 }, { fifth_name: 'Extra' }, { players: ['Alex', 'Sam', 'Extra'] }
  ])('invalid full roster edits do not acquire a transaction or alter names: %p', async (roster) => {
    players = [player({ third_name: 'Casey', fourth_name: 'Taylor' })];
    const response = await authorized(request(app).patch('/api/players/1').send({ name: 'Alex', second_name: 'Sam', ...roster }));
    expect(response.status).toBe(400);
    expect(pool.getConnection).not.toHaveBeenCalled();
    expect(players[0]).toMatchObject({ name: 'Alex', second_name: 'Sam', third_name: 'Casey', fourth_name: 'Taylor' });
  });

  test.each([
    { name: 'Alex' }, { second_name: 'Sam' }, { name: 'Alex', second_name: '  ' },
    { name: '', second_name: 'Sam' }, { name: 'Alex', second_name: 'x'.repeat(101) }
  ])('rename rejects an incomplete pair without acquiring a transaction: %p', async (body) => {
    players = [player()];
    const response = await authorized(request(app).patch('/api/players/1').send(body));
    expect(response.status).toBe(400);
    expect(pool.getConnection).not.toHaveBeenCalled();
    expect(players[0]).toMatchObject({ name: 'Alex', second_name: 'Sam' });
  });

  test.each(['waiting', 'paused'])('legacy %s session must add a second name before starting', async (status) => {
    players = [player({ second_name: null, status, remaining_seconds: 300 })];
    const response = await authorized(request(app).post('/api/players/1/timer').send({ action: 'start' }));
    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Add the second player name before starting this session.');
    expect(players[0]).toMatchObject({ name: 'Alex', second_name: null, status, remaining_seconds: 300 });
    expect(connection.rollback).toHaveBeenCalledTimes(1);
  });

  test('legacy pair upgrade retains remaining time and can resume its saved timer', async () => {
    players = [player({ second_name: null, status: 'paused', remaining_seconds: 300.125 })];
    let response = await authorized(request(app).patch('/api/players/1').send({ name: 'Alex', second_name: 'Sam' }));
    expect(response.status).toBe(200);
    expect(response.body.data.player).toMatchObject({ name: 'Alex', second_name: 'Sam', status: 'paused', remaining_seconds: 300.125 });
    response = await authorized(request(app).post('/api/players/1/timer').send({ action: 'start' }));
    expect(response.status).toBe(200);
    expect(response.body.data.player).toMatchObject({ name: 'Alex', second_name: 'Sam', status: 'running', remaining_seconds: 300.125, timer_started_at: now });
  });

  test.each(['pause', 'reset', 'finish'])('legacy running sessions still allow %s without inventing a second player', async (action) => {
    players = [player({ second_name: null, status: 'running', timer_started_at: now - 1250, remaining_seconds: 300.125 })];
    const response = await authorized(request(app).post('/api/players/1/timer').send({ action }));
    expect(response.status).toBe(200);
    expect(response.body.data.player).toMatchObject({ name: 'Alex', second_name: null });
    if (action === 'pause') expect(response.body.data.player.remaining_seconds).toBe(298.875);
    expect(players[0].name).toBe('Alex');
  });

  test('start, pause and resume use elapsed server time without resetting the session', async () => {
    players = [player()];
    let response = await authorized(request(app).post('/api/players/1/timer').send({ action: 'start' }));
    expect(response.body.data.player).toMatchObject({ status: 'running', timer_started_at: now, remaining_seconds: 3600 });
    now += 12250;
    response = await authorized(request(app).post('/api/players/1/timer').send({ action: 'pause' }));
    expect(response.body.data.player).toMatchObject({ status: 'paused', timer_started_at: null, remaining_seconds: 3587.75 });
    now += 30000;
    response = await authorized(request(app).post('/api/players/1/timer').send({ action: 'start' }));
    expect(response.body.data.player).toMatchObject({ status: 'running', timer_started_at: now, remaining_seconds: 3587.75 });
    expect(connection.execute.mock.calls.filter(([sql]) => sql.includes('FOR UPDATE'))).toHaveLength(3);
  });

  test('duplicate start is rejected and rolls back without changing the original timer', async () => {
    players = [player({ status: 'running', timer_started_at: now - 30000 })];
    const response = await authorized(request(app).post('/api/players/1/timer').send({ action: 'start' }));
    expect(response.status).toBe(409);
    expect(players[0].timer_started_at).toBe(now - 30000);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test.each(['waiting', 'paused', 'finished'])('does not pause a %s timer', async (status) => {
    players = [player({ status })];
    const response = await authorized(request(app).post('/api/players/1/timer').send({ action: 'pause' }));
    expect(response.status).toBe(409);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  test('expired timer cannot be restarted until reset; reset can change duration', async () => {
    players = [player({ status: 'running', timer_started_at: now - 3600000 })];
    let response = await authorized(request(app).post('/api/players/1/timer').send({ action: 'start' }));
    expect(response.status).toBe(409);
    response = await authorized(request(app).post('/api/players/1/timer').send({ action: 'reset', duration_minutes: 15 }));
    expect(response.status).toBe(200);
    expect(response.body.data.player).toMatchObject({ status: 'waiting', duration_seconds: 900, remaining_seconds: 900, timer_started_at: null });
  });

  test('finish stops the timer; reset restores its configured duration', async () => {
    players = [player({ duration_seconds: 1200, remaining_seconds: 1200, status: 'running', timer_started_at: now })];
    let response = await authorized(request(app).post('/api/players/1/timer').send({ action: 'finish' }));
    expect(response.body.data.player).toMatchObject({ status: 'finished', remaining_seconds: 0, timer_started_at: null });
    response = await authorized(request(app).post('/api/players/1/timer').send({ action: 'reset' }));
    expect(response.body.data.player).toMatchObject({ status: 'waiting', duration_seconds: 1200, remaining_seconds: 1200 });
  });

  test.each([
    { action: 'unknown' }, { action: ['start'] }, { action: 'start', duration_minutes: 15 },
    { action: 'reset', duration_minutes: 0 }, { action: 'reset', duration_minutes: '15' }
  ])('rejects invalid timer instruction %p before acquiring a connection', async (body) => {
    const response = await authorized(request(app).post('/api/players/1/timer').send(body));
    expect(response.status).toBe(400);
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test.each(['0', '-1', '1xyz', '9007199254740992'])('rejects malformed player id %s', async (id) => {
    const response = await authorized(request(app).patch(`/api/players/${id}`).send({ name: 'Alex' }));
    expect(response.status).toBe(400);
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test('archive excludes a player from the list without deleting the database row', async () => {
    players = [player()];
    const response = await authorized(request(app).delete('/api/players/1'));
    expect(response.status).toBe(200);
    expect(players).toHaveLength(1);
    expect(players[0].is_active).toBe(0);
    const listed = await authorized(request(app).get('/api/players'));
    expect(listed.body.data.players).toEqual([]);
    const restarted = await authorized(request(app).post('/api/players/1/timer').send({ action: 'start' }));
    expect(restarted.status).toBe(404);
  });

  test('missing players return 404 and release the locked transaction', async () => {
    const response = await authorized(request(app).patch('/api/players/1').send({ name: 'Alex', second_name: 'Sam' }));
    expect(response.status).toBe(404);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test('database update failure rolls back and never returns a saved player', async () => {
    players = [player()];
    connection.execute.mockResolvedValueOnce([[player()]]).mockRejectedValueOnce(new Error('Database unavailable'));
    const response = await authorized(request(app).post('/api/players/1/timer').send({ action: 'start' }));
    expect(response.status).toBe(500);
    expect(response.body.data).toBeUndefined();
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(players[0].status).toBe('waiting');
  });

  test.each(['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'])('schema error %s provides an actionable setup response', async (code) => {
    const implementation = pool.execute.getMockImplementation();
    pool.execute.mockImplementation((sql, args) => sql.includes('FROM walk_in_players')
      ? Promise.reject(Object.assign(new Error('Missing player schema'), { code }))
      : implementation(sql, args));
    const response = await authorized(request(app).get('/api/players'));
    expect(response.status).toBe(503);
    expect(response.body.message).toContain('npm run db:migrate:players');
  });
});

describe('Player timer arithmetic', () => {
  test('coerces MySQL decimal and bigint strings without losing the timer anchor', () => {
    expect(serializePlayer({ id: '4', name: 'Alex', duration_seconds: '3600', remaining_seconds: '3200.250', timer_started_at: '10000', status: 'running' }, 11000))
      .toEqual({ id: 4, name: 'Alex', second_name: null, third_name: null, fourth_name: null, duration_seconds: 3600, remaining_seconds: 3200.25, timer_started_at: 10000, status: 'running' });
  });
  test('four player names survive timer serialization and expiration', () => {
    const result = serializePlayer({ id: '5', name: 'Alex', second_name: 'Sam', third_name: 'Casey', fourth_name: 'Taylor', duration_seconds: '60', remaining_seconds: '60', timer_started_at: '10000', status: 'running' }, 70000);
    expect(result).toMatchObject({ id: 5, name: 'Alex', second_name: 'Sam', third_name: 'Casey', fourth_name: 'Taylor', remaining_seconds: 0, timer_started_at: null, status: 'finished' });
  });
  test('a backwards clock does not add extra time during pause', () => {
    const result = timerTransition({ id: 4, name: 'Alex', duration_seconds: 3600, remaining_seconds: 300, timer_started_at: 20000, status: 'running' }, 'pause', undefined, 10000);
    expect(result.remaining_seconds).toBe(300);
    expect(result.status).toBe('paused');
  });
});
