jest.mock('../src/config/db', () => ({ pool: { execute: jest.fn() }, getConnection: jest.fn() }));
jest.mock('../src/utils/paymentInstructions', () => ({ loadPaymentInstructions: jest.fn() }));
jest.mock('../src/models/Notification', () => ({ create: jest.fn() }));
jest.mock('../src/models/AuditLog', () => ({ log: jest.fn() }));
jest.mock('../src/config/email', () => ({ sendReservationConfirmationEmail: jest.fn() }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { pool, getConnection } = require('../src/config/db');
const Reservation = require('../src/models/Reservation');
const Payment = require('../src/models/Payment');
const Notification = require('../src/models/Notification');
const { loadPaymentInstructions } = require('../src/utils/paymentInstructions');
const { sendReservationConfirmationEmail } = require('../src/config/email');
const reservationController = require('../src/controllers/reservationController');
const paymentController = require('../src/controllers/paymentController');
const staffRoutes = require('../src/routes/staff');
const reservationRoutes = require('../src/routes/reservations');
const app = express();
app.use(express.json());
app.use('/api/staff', staffRoutes);
app.use('/api/reservations', reservationRoutes);

describe('Front desk court booking and recorded payment', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalZone = process.env.BUSINESS_TIMEZONE;
  let connection, settings, court, hours, closures, conflicts, customers, usedReference, failAt, role, ledger, snapshot;
  const operator = { id: 4, name: 'Front Desk Operator', role: 'staff', is_active: 1 };
  const booking = (overrides = {}) => ({
    userId: null, courtId: 3, paymentMethod: 'cash',
    counter: { operator, startNow: true, durationHours: 1, amountReceived: '800.00', paymentReceived: true, customerName: 'Walk-in Player', customerPhone: '09123456789', ipAddress: '127.0.0.1' },
    ...overrides
  });
  const body = (overrides = {}) => ({ court_id: 3, customer_name: 'Walk-in Player', customer_phone: '09123456789', start_now: true, duration_hours: 1, payment_method: 'cash', amount_received: '800.00', payment_received: true, ...overrides });
  const auth = operation => operation.set('Authorization', `Bearer ${jwt.sign({ id: operator.id }, process.env.JWT_SECRET)}`);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout'] }).setSystemTime(new Date('2026-11-02T01:17:30Z'));
    process.env.JWT_SECRET = 'counter-booking-test-only';
    process.env.BUSINESS_TIMEZONE = 'Asia/Manila';
    role = 'staff'; failAt = ''; usedReference = false;
    settings = { booking_advance_days: '30', min_booking_duration: '1', max_booking_duration: '4', booking_slot_interval: '60', require_admin_approval: 'true' };
    court = { id: 3, name: 'Indoor Court', price_per_hour: '800.00', is_active: 1 };
    hours = { open_time: '08:00:00', close_time: '22:00:00', is_closed: 0 };
    closures = []; conflicts = []; customers = [{ id: 8, name: 'Registered Player', email: 'player@example.test', phone: '09987654321' }];
    ledger = { reservations: [], payments: [], verifications: [], audits: [] };
    loadPaymentInstructions.mockResolvedValue({ gcash: { configured: true } });
    Notification.create.mockResolvedValue({ id: 1 });
    sendReservationConfirmationEmail.mockResolvedValue({ success: true, status: 'simulated' });
    connection = {
      beginTransaction: jest.fn(async () => { snapshot = JSON.parse(JSON.stringify(ledger)); }),
      commit: jest.fn(async () => { if (failAt === 'commit') throw new Error('Commit unavailable'); }),
      rollback: jest.fn(async () => { ledger = snapshot; }),
      release: jest.fn(),
      execute: jest.fn(async (sql, params = []) => {
        if (failAt && sql.startsWith(failAt)) throw new Error('Ledger unavailable');
        if (sql.includes('FROM settings')) return [Object.entries(settings).map(([setting_key, setting_value]) => ({ setting_key, setting_value }))];
        if (sql.includes('FROM courts')) return [court ? [court] : []];
        if (sql.includes('FROM court_operating_hours')) return [hours ? [hours] : []];
        if (sql.includes('FROM court_closures')) return [closures];
        if (sql.includes('FROM reservations') && sql.includes('FOR UPDATE')) return [conflicts];
        if (sql.includes('FROM reservations')) return [[]];
        if (sql.includes('FROM payments')) return [usedReference ? [{ id: 99 }] : []];
        if (sql.includes('FROM users')) return [customers];
        if (sql.startsWith('INSERT INTO reservations')) { ledger.reservations.push(params); return [{ insertId: 71 }]; }
        if (sql.startsWith('INSERT INTO payments')) { ledger.payments.push(params); return [{ insertId: 81 }]; }
        if (sql.startsWith('INSERT INTO payment_verifications')) { ledger.verifications.push(params); return [{ insertId: 91 }]; }
        if (sql.startsWith('INSERT INTO audit_logs')) { ledger.audits.push(params); return [{ insertId: 101 }]; }
        throw new Error('Unexpected isolated counter SQL');
      })
    };
    getConnection.mockResolvedValue(connection);
    pool.execute.mockImplementation(async (sql) => {
      if (sql.includes('FROM users WHERE id')) return [[{ ...operator, role }]];
      if (sql.includes("WHERE role = 'customer'")) return [customers];
      throw new Error('Unexpected isolated counter pool SQL');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
    if (originalZone === undefined) delete process.env.BUSINESS_TIMEZONE; else process.env.BUSINESS_TIMEZONE = originalZone;
  });

  test('records immediate cash booking, verification, and operator audit in one transaction', async () => {
    const lookup = jest.spyOn(Reservation, 'findById').mockRejectedValue(new Error('Post-save lookup unavailable'));
    const result = await Reservation.createReservation(booking());
    expect(result).toMatchObject({ user_id: null, user_name: 'Walk-in Player', user_phone: '09123456789', booking_source: 'front_desk', booked_by: 4, reservation_date: '2026-11-02', start_time: '09:17:00', end_time: '10:17:00', status: 'completed', total_price: 800, services: [] });
    expect(result.payments).toEqual([expect.objectContaining({ amount: 800, payment_status: 'verified', payment_method: 'cash', verified_by_name: operator.name })]);
    expect(ledger.reservations).toHaveLength(1); expect(ledger.payments).toHaveLength(1); expect(ledger.verifications).toHaveLength(1); expect(ledger.audits).toHaveLength(1);
    expect(ledger.reservations[0].slice(12)).toEqual(['Walk-in Player', '09123456789', 4]);
    expect(ledger.verifications[0]).toEqual([81, 4, expect.stringContaining('Customer checked in')]);
    expect(JSON.parse(ledger.audits[0][4])).toMatchObject({ payment_id: 81, payment_method: 'cash', amount: 800, checked_in: true, customer_id: null });
    expect(connection.execute.mock.calls.find(([sql]) => sql.includes('FROM courts'))[0]).toContain('FOR UPDATE');
    expect(connection.commit).toHaveBeenCalledTimes(1); expect(connection.rollback).not.toHaveBeenCalled(); expect(connection.release).toHaveBeenCalled(); expect(lookup).not.toHaveBeenCalled();
  });

  test('records scheduled pay-and-play as confirmed while ordinary approval remains enabled', async () => {
    const data = booking({ reservationDate: '2026-11-03', startTime: '08:00', endTime: '09:00' }); data.counter.startNow = false;
    const result = await Reservation.createReservation(data);
    expect(result.status).toBe('confirmed'); expect(result.start_time).toBe('08:00:00'); expect(result.payments[0].payment_status).toBe('verified');
  });

  test('stores a normalized GCash reference and a verified ledger entry', async () => {
    const data = booking({ paymentMethod: 'gcash' }); data.counter.transactionReference = '  gcash-counter-01 ';
    const result = await Reservation.createReservation(data);
    expect(result.payments[0]).toMatchObject({ payment_method: 'gcash', transaction_reference: 'GCASH-COUNTER-01', payment_status: 'verified' });
    expect(ledger.payments[0][3]).toBe('GCASH-COUNTER-01'); expect(ledger.verifications).toHaveLength(1);
  });

  test('attaches a registered active customer without changing the account', async () => {
    const result = await Reservation.createReservation(booking({ userId: 8 }));
    expect(result).toMatchObject({ user_id: 8, user_name: 'Registered Player', user_email: 'player@example.test', walk_in_name: null, walk_in_phone: null });
    const lookup = connection.execute.mock.calls.find(([sql]) => sql.includes('FROM users'))[0];
    expect(lookup).toContain("role = 'customer' AND is_active = 1 FOR UPDATE");
    expect(connection.execute.mock.calls.some(([sql]) => /^(INSERT INTO|UPDATE) users/.test(sql))).toBe(false);
  });

  test.each(['1.00', '799.99', '800.01', '1600.00'])('rejects received amount %s instead of trusting it as the booking price', async amount => {
    const data = booking(); data.counter.amountReceived = amount;
    await expect(Reservation.createReservation(data)).rejects.toMatchObject({ statusCode: 409 });
    expect(ledger.reservations).toHaveLength(0); expect(ledger.payments).toHaveLength(0); expect(connection.commit).not.toHaveBeenCalled();
  });

  test.each(['INSERT INTO payments', 'INSERT INTO payment_verifications', 'INSERT INTO audit_logs', 'commit'])('rolls back every new record when %s fails', async failure => {
    failAt = failure;
    await expect(Reservation.createReservation(booking())).rejects.toThrow(/unavailable/i);
    expect(ledger).toEqual({ reservations: [], payments: [], verifications: [], audits: [] }); expect(connection.rollback).toHaveBeenCalledTimes(1); expect(connection.release).toHaveBeenCalled();
  });

  test('rejects a reused GCash reference without creating a booking or payment', async () => {
    usedReference = true; const data = booking({ paymentMethod: 'gcash' }); data.counter.transactionReference = 'REUSED-REFERENCE';
    await expect(Reservation.createReservation(data)).rejects.toMatchObject({ statusCode: 409 }); expect(ledger.reservations).toHaveLength(0);
  });

  test('maps a raced unique-reference failure to conflict after rollback', async () => {
    const implementation = connection.execute.getMockImplementation();
    connection.execute.mockImplementation((sql, ...args) => sql.startsWith('INSERT INTO payments') ? Promise.reject(Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' })) : implementation(sql, ...args));
    await expect(Reservation.createReservation(booking())).rejects.toMatchObject({ statusCode: 409 }); expect(ledger.reservations).toHaveLength(0); expect(connection.rollback).toHaveBeenCalled();
  });

  test('keeps occupied or completed court times unavailable', async () => {
    conflicts = [{ id: 9, status: 'completed' }];
    await expect(Reservation.createReservation(booking())).rejects.toThrow('no longer available'); expect(ledger.payments).toHaveLength(0);
    expect(connection.execute.mock.calls.find(([sql]) => sql.includes('FROM reservations') && sql.includes('FOR UPDATE'))[0]).toContain("'completed'");
  });

  test.each(['closed', 'closure', 'inactive', 'missing'])('rejects %s courts before recording money', async reason => {
    if (reason === 'closed') hours.is_closed = 1;
    if (reason === 'closure') closures = [{ reason: 'Maintenance' }];
    if (reason === 'inactive') court.is_active = 0;
    if (reason === 'missing') court = null;
    await expect(Reservation.createReservation(booking())).rejects.toThrow(); expect(ledger.payments).toHaveLength(0); expect(connection.commit).not.toHaveBeenCalled();
  });

  test('enforces closing hours and duration limits for immediate play', async () => {
    hours.close_time = '10:00:00'; await expect(Reservation.createReservation(booking())).rejects.toThrow('operating hours');
    hours.close_time = '22:00:00'; const data = booking(); data.counter.durationHours = 5;
    await expect(Reservation.createReservation(data)).rejects.toThrow('between 1 and 4 hours');
  });

  test('rejects an inactive or missing registered customer', async () => {
    customers = [];
    await expect(Reservation.createReservation(booking({ userId: 8 }))).rejects.toMatchObject({ statusCode: 404 }); expect(ledger.reservations).toHaveLength(0);
  });

  test('does not weaken the ordinary customer slot grid for counter immediacy', async () => {
    await expect(Reservation.createReservation({ userId: 8, courtId: 3, reservationDate: '2026-11-03', startTime: '09:17', endTime: '10:17' })).rejects.toThrow('60-minute time slots');
    expect(ledger.payments).toHaveLength(0);
  });

  test.each(['role', 'receipt'])('internal counter entry validates %s before opening a transaction', async field => {
    const data = booking();
    if (field === 'role') data.counter.operator = { ...operator, role: 'customer' }; else data.counter.paymentReceived = false;
    await expect(Reservation.createReservation(data)).rejects.toMatchObject({ statusCode: 403 }); expect(getConnection).not.toHaveBeenCalled();
  });

  test.each([['post', '/api/staff/walk-in-reservations'], ['get', '/api/staff/customers?search=Player']])('%s %s requires authentication and blocks customer accounts', async (method, path) => {
    expect((await request(app)[method](path).send(body())).status).toBe(401);
    role = 'customer'; expect((await auth(request(app)[method](path).send(body()))).status).toBe(403); expect(getConnection).not.toHaveBeenCalled();
  });

  test.each(['staff', 'admin'])('%s can save a received cash payment and receive a printable saved result', async authorizedRole => {
    role = authorizedRole;
    const response = await auth(request(app).post('/api/staff/walk-in-reservations').send(body()));
    expect(response.status).toBe(201); expect(response.body.data.reservation).toMatchObject({ user_name: 'Walk-in Player', booking_source: 'front_desk', status: 'completed', payments: [expect.objectContaining({ payment_status: 'verified' })] }); expect(response.body.data.payment.id).toBe(81);
  });

  test.each([
    { payment_received: false }, { payment_received: 'true' }, { amount_received: '800.001' }, { amount_received: -1 },
    { customer_name: ' ' }, { customer_name: ['Player'] }, { customer_name: 'x'.repeat(101) }, { customer_phone: 'x'.repeat(21) },
    { court_id: '3abc' }, { payment_method: 'online' }, { start_now: 'true' }, { duration_hours: 1.25 }, { booked_by: 1 }
  ])('rejects malformed counter input %p before opening its transaction', async fields => {
    const response = await auth(request(app).post('/api/staff/walk-in-reservations').send(body(fields)));
    expect(response.status).toBe(400); expect(getConnection).not.toHaveBeenCalled();
  });

  test.each(['', ' '])('GCash needs an actual reference (%p)', async reference => {
    const response = await auth(request(app).post('/api/staff/walk-in-reservations').send(body({ payment_method: 'gcash', transaction_reference: reference })));
    expect(response.status).toBe(400); expect(getConnection).not.toHaveBeenCalled();
  });

  test('GCash needs configured merchant details before counter verification', async () => {
    loadPaymentInstructions.mockResolvedValue({ gcash: { configured: false } });
    const response = await auth(request(app).post('/api/staff/walk-in-reservations').send(body({ payment_method: 'gcash', transaction_reference: 'COUNTER-VALID-REFERENCE' })));
    expect(response.status).toBe(400); expect(getConnection).not.toHaveBeenCalled();
  });

  test('customer lookup returns only the bounded active-account search contract', async () => {
    const response = await auth(request(app).get('/api/staff/customers?search=Player'));
    expect(response.status).toBe(200); expect(response.body.data.customers).toEqual(customers);
    const query = pool.execute.mock.calls.find(([sql]) => sql.includes("WHERE role = 'customer'"));
    expect(query[0]).toContain('is_active = 1'); expect(query[0]).toContain('LIMIT 20'); expect(query[1]).toEqual(['%Player%', '%Player%', '%Player%']); expect(query[0]).not.toContain('password');
  });

  test.each(['', 'P', 'x'.repeat(101)])('rejects an unbounded or insufficient customer search %p', async search => {
    expect((await auth(request(app).get('/api/staff/customers').query({ search }))).status).toBe(400);
    expect(pool.execute).toHaveBeenCalledTimes(1);
  });

  test('normal reservation controller ignores injected counter/payment flags', async () => {
    const create = jest.spyOn(Reservation, 'createReservation').mockResolvedValue({ id: 1, user_id: 8, court_name: 'Indoor Court', reference_number: 'PB-NORMAL', payments: [{ payment_status: 'pending' }] });
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await reservationController.createReservation({ user: { id: 8, name: 'Player', email: 'player@example.test' }, body: { court_id: 3, reservation_date: '2026-11-03', start_time: '09:00', end_time: '10:00', payment_method: 'cash', counter: booking().counter, payment_received: true, payment_status: 'verified', customer_id: 1 }, ip: '127.0.0.1' }, response);
    expect(create.mock.calls[0][0]).toEqual({ userId: 8, courtId: 3, reservationDate: '2026-11-03', startTime: '09:00', endTime: '10:00', services: [], notes: null, paymentMethod: 'cash' });
    expect(response.status).toHaveBeenCalledWith(201);
  });

  test('unrelated customers cannot read a walk-in reservation or its payment', async () => {
    const guest = { id: 71, user_id: null, user_name: 'Walk-in Player', total_price: 800, status: 'confirmed' };
    jest.spyOn(Reservation, 'findById').mockResolvedValue(guest);
    jest.spyOn(Payment, 'findById').mockResolvedValue({ ...guest, id: 81, reservation_id: 71 });
    const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
    const reservationResponse = response(), paymentResponse = response();
    const req = { params: { id: 71 }, user: { id: 8, role: 'customer' } };
    await reservationController.getReservationById(req, reservationResponse); await paymentController.getPaymentById(req, paymentResponse);
    expect(reservationResponse.status).toHaveBeenCalledWith(403); expect(paymentResponse.status).toHaveBeenCalledWith(403);
  });

  test('guest bookings can be managed without attempting notifications to a missing account', async () => {
    jest.spyOn(Reservation, 'updateStatus').mockResolvedValue({ id: 71, user_id: null, reference_number: 'PB-GUEST', status: 'confirmed' });
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await reservationController.updateStatus({ params: { id: 71 }, user: operator, body: { status: 'confirmed' }, ip: '127.0.0.1' }, response);
    expect(response.status).toHaveBeenCalledWith(200); expect(Notification.create).not.toHaveBeenCalled();
  });
});
