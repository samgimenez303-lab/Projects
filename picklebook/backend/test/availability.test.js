jest.mock('../src/config/db', () => ({ pool: { execute: jest.fn() } }));
const { pool } = require('../src/config/db');
const Court = require('../src/models/Court');
const courtController = require('../src/controllers/courtController');

describe('Court availability and booking policy', () => {
  let settings;
  let court;
  let hours;
  let closures;
  let occupied;
  let previousTimezone;
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-25T00:00:00Z'));
    previousTimezone = process.env.BUSINESS_TIMEZONE;
    process.env.BUSINESS_TIMEZONE = 'Asia/Manila';
    settings = { booking_advance_days: '60', min_booking_duration: '1.5', max_booking_duration: '4', booking_slot_interval: '30' };
    court = { id: 3, name: 'Indoor Court', price_per_hour: '800.00', is_active: 1 };
    hours = [{ open_time: '08:30:00', close_time: '10:45:00', is_closed: 0 }];
    closures = [];
    occupied = [];
    jest.spyOn(Court, 'findById').mockImplementation(async () => court);
    pool.execute.mockImplementation(async (sql) => {
      if (sql.includes('FROM settings')) return [Object.entries(settings).map(([setting_key, setting_value]) => ({ setting_key, setting_value }))];
      if (sql.includes('FROM court_closures')) return [closures];
      if (sql.includes('FROM court_operating_hours')) return [hours];
      if (sql.includes('FROM reservations')) return [occupied];
      throw new Error(`Unexpected availability query: ${sql}`);
    });
  });
  afterEach(() => {
    jest.restoreAllMocks(); jest.useRealTimers();
    if (previousTimezone === undefined) delete process.env.BUSINESS_TIMEZONE;
    else process.env.BUSINESS_TIMEZONE = previousTimezone;
  });

  test('builds half-hour slots from opening minutes and never extends beyond closing time', async () => {
    const result = await Court.getAvailability(3, '2026-10-26');
    expect(result.slots).toEqual([
      { start_time: '08:30', end_time: '09:00', is_available: true },
      { start_time: '09:00', end_time: '09:30', is_available: true },
      { start_time: '09:30', end_time: '10:00', is_available: true },
      { start_time: '10:00', end_time: '10:30', is_available: true }
    ]);
    expect(result).toMatchObject({ booking_advance_days: 60, min_booking_duration: 1.5, max_booking_duration: 4, booking_slot_interval: 30, business_timezone: 'Asia/Manila' });
  });

  test('honors an hourly setting with a half-hour opening time', async () => {
    settings.booking_slot_interval = '60';
    const result = await Court.getAvailability(3, '2026-10-26');
    expect(result.slots).toEqual([
      { start_time: '08:30', end_time: '09:30', is_available: true },
      { start_time: '09:30', end_time: '10:30', is_available: true }
    ]);
  });

  test('keeps completed bookings occupied without publishing booking IDs or references', async () => {
    occupied = [{ id: 55, reference_number: 'PRIVATE-REF', start_time: '09:00:00', end_time: '10:00:00', status: 'completed' }];
    const result = await Court.getAvailability(3, '2026-10-26');
    expect(result.slots.map((slot) => slot.is_available)).toEqual([true, false, false, true]);
    expect(result.booked_reservations).toEqual([{ start_time: '09:00:00', end_time: '10:00:00' }]);
    expect(JSON.stringify(result)).not.toContain('PRIVATE-REF');
    expect(result.slots.every((slot) => !Object.hasOwn(slot, 'reservation_id'))).toBe(true);
    expect(pool.execute.mock.calls.find(([sql]) => sql.includes('FROM reservations'))[0]).toContain("'completed'");
  });

  test.each(['2026-02-30', '2026-10-26T10:00:00', 'invalid'])('rejects invalid date %s before database access', async (date) => {
    pool.execute.mockClear();
    await expect(Court.getAvailability(3, date)).rejects.toMatchObject({ statusCode: 400 });
    expect(pool.execute).not.toHaveBeenCalled();
  });

  test.each(['inactive', 'closure', 'weekly closure', 'past', 'future'])('includes policy metadata when unavailable due to %s', async (reason) => {
    let date = '2026-10-26';
    if (reason === 'inactive') court.is_active = 0;
    if (reason === 'closure') closures = [{ reason: 'Maintenance' }];
    if (reason === 'weekly closure') hours[0].is_closed = 1;
    if (reason === 'past') date = '2026-10-24';
    if (reason === 'future') date = '2027-01-01';
    const result = await Court.getAvailability(3, date);
    expect(result).toMatchObject({ is_available: false, slots: [], booking_advance_days: 60, min_booking_duration: 1.5, booking_slot_interval: 30, business_timezone: 'Asia/Manila' });
    expect(result.reason).toBeTruthy();
  });

  test('disables past start times in the configured facility time zone', async () => {
    hours[0] = { open_time: '07:30:00', close_time: '09:00:00', is_closed: 0 };
    const result = await Court.getAvailability(3, '2026-10-25');
    expect(result.slots.map((slot) => slot.is_available)).toEqual([false, false, true]);
  });

  test('fails clearly for unsupported quarter-hour settings instead of rounding durations', async () => {
    settings.booking_slot_interval = '15';
    await expect(Court.getAvailability(3, '2026-10-26')).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('30 or 60') });
  });

  test('allows a zero-day advance setting for same-day bookings', async () => {
    settings.booking_advance_days = '0';
    await expect(Court.getAvailability(3, '2026-10-25')).resolves.toMatchObject({ booking_advance_days: 0, is_available: true });
    await expect(Court.getAvailability(3, '2026-10-26')).resolves.toMatchObject({ is_available: false, reason: expect.stringContaining('next 0 days') });
  });

  test('returns an HTTP400 validation message for an invalid availability date', async () => {
    const req = { params: { id: '3' }, query: { date: '2026-02-30' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await courtController.getCourtAvailability(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Choose a valid reservation date.' }));
  });
});
