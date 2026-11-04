jest.mock('../src/config/db', () => ({ pool: { execute: jest.fn() } }));
jest.mock('../src/utils/bookingPolicy', () => ({ facilityNow: jest.fn(() => ({ date: '2026-11-01', time: '01:00:00' })) }));

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../src/config/db');
const routes = require('../src/routes/dashboard');
const { MONTHLY_COURT_FINANCE_SQL, ATTENTION_SQL, PAYMENT_QUEUE_SQL, TODAY_SCHEDULE_SQL } = require('../src/utils/dashboardOverview');
const app = express();
app.use('/api/dashboard', routes);

describe('Admin overview authorization and response', () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousTimeZone = process.env.BUSINESS_TIMEZONE;
  let role;
  let token;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'dashboard-test-only-secret';
    process.env.BUSINESS_TIMEZONE = 'Asia/Manila';
    role = 'admin';
    token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
    pool.execute.mockImplementation(async (sql) => {
      if (sql.includes('FROM users WHERE id')) return [[{ id: 1, name: 'Test Admin', role, is_active: 1 }]];
      if (sql === MONTHLY_COURT_FINANCE_SQL) return [[{ court_id: 3, court_name: 'Indoor', expected_income: '1000.00', verified_income: '400.00', outstanding_income: '600.00', pending_approval_value: '200.00', confirmed_bookings: '1', pending_approval_bookings: '1', booked_hours: '2' }]];
      if (sql === ATTENTION_SQL) return [[{ payment_verifications: '2', cash_collections: '3', pending_reservations: '1', new_inquiries: '4' }]];
      if (sql === PAYMENT_QUEUE_SQL) return [[{ id: 9, amount: '200.00', payment_status: 'submitted', payment_method: 'gcash' }]];
      if (sql === TODAY_SCHEDULE_SQL) return [[{ id: 7, total_price: '1000.00', duration_hours: '2', status: 'confirmed' }]];
      throw new Error('Unexpected query in isolated dashboard test');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { jest.restoreAllMocks(); });
  afterAll(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
    if (previousTimeZone === undefined) delete process.env.BUSINESS_TIMEZONE; else process.env.BUSINESS_TIMEZONE = previousTimeZone;
  });

  test('requires authentication', async () => {
    const response = await request(app).get('/api/dashboard/overview');
    expect(response.status).toBe(401);
    expect(pool.execute).not.toHaveBeenCalled();
  });

  test.each(['customer', 'staff'])('blocks authenticated %s roles before reading financial data', async (restrictedRole) => {
    role = restrictedRole;
    const response = await request(app).get('/api/dashboard/overview').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(pool.execute).toHaveBeenCalledTimes(1);
  });

  test('returns the additive numeric overview contract and parameterized month/today dates', async () => {
    const response = await request(app).get('/api/dashboard/overview?month=2026-10').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      month: '2026-10', time_zone: 'Asia/Manila', today: '2026-11-01',
      finance: { expected_income: 1000, verified_income: 400, outstanding_income: 600, pending_approval_value: 200, confirmed_bookings: 1, pending_approval_bookings: 1 },
      court_activity: [{ court_id: 3, court_name: 'Indoor', booking_count: 1, booked_hours: 2, expected_income: 1000 }],
      attention: { payment_verifications: 2, cash_collections: 3, pending_reservations: 1, new_inquiries: 4 },
      payment_queue: [{ id: 9, amount: 200, payment_status: 'submitted', payment_method: 'gcash' }],
      today_schedule: [{ id: 7, total_price: 1000, duration_hours: 2, status: 'confirmed' }]
    });
    expect(pool.execute).toHaveBeenCalledWith(MONTHLY_COURT_FINANCE_SQL, ['2026-10-01', '2026-10-31', '2026-10-01', '2026-10-31']);
    expect(pool.execute).toHaveBeenCalledWith(TODAY_SCHEDULE_SQL, ['2026-11-01']);
  });

  test('defaults to the facility-local current month', async () => {
    const response = await request(app).get('/api/dashboard/overview').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.month).toBe('2026-11');
  });

  test.each(['2026-13', '2026-02-01', '2026-2', '2026-10&month=2026-11'])('rejects invalid/repeated month %s before running report queries', async (month) => {
    const response = await request(app).get(`/api/dashboard/overview?month=${month}`).set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
    expect(pool.execute).toHaveBeenCalledTimes(1);
  });

  test('returns a report error without exposing a partial financial snapshot', async () => {
    const implementation = pool.execute.getMockImplementation();
    pool.execute.mockImplementation((sql, ...args) => sql === MONTHLY_COURT_FINANCE_SQL ? Promise.reject(new Error('Report unavailable')) : implementation(sql, ...args));
    const response = await request(app).get('/api/dashboard/overview').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(500);
    expect(response.body.data).toBeUndefined();
    expect(response.body.message).toBe('Failed to retrieve the dashboard overview.');
  });
});
