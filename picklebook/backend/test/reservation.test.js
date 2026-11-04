jest.mock('../src/config/db', () => ({ pool: { execute: jest.fn() }, getConnection: jest.fn() }));
const { getConnection } = require('../src/config/db');
const Reservation = require('../src/models/Reservation');

describe('Reservation checkout rules', () => {
  let connection;
  let settings;
  let booking;
  let conflicts;
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-25T00:00:00Z'));
    settings = { booking_advance_days: '30', min_booking_duration: '1', max_booking_duration: '4', booking_slot_interval: '60', require_admin_approval: 'false' };
    booking = { userId: 5, courtId: 3, reservationDate: '2026-10-26', startTime: '08:00', endTime: '09:00', paymentMethod: 'cash' };
    conflicts = [];
    connection = {
      beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
      execute: jest.fn(async (sql) => {
        if (sql.includes('FROM settings')) return [Object.entries(settings).map(([setting_key, setting_value]) => ({ setting_key, setting_value }))];
        if (sql.includes('FROM courts')) return [[{ id: 3, name: 'Indoor Court', price_per_hour: '800.00', is_active: 1 }]];
        if (sql.includes('FROM court_operating_hours')) return [[{ open_time: '08:00:00', close_time: '22:00:00', is_closed: 0 }]];
        if (sql.includes('FROM court_closures')) return [[]];
        if (sql.includes('FROM reservations') && sql.includes('FOR UPDATE')) return [conflicts];
        if (sql.includes('FROM reservations')) return [[]];
        return [{ insertId: 7, affectedRows: 1 }];
      })
    };
    getConnection.mockResolvedValue(connection);
    jest.spyOn(Reservation, 'findById').mockResolvedValue({ id: 7, payments: [{ payment_status: 'pending' }] });
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  test('accepts the opening-hour HH:mm input and commits booking and pending payment together', async () => {
    await Reservation.createReservation(booking);
    const insert = connection.execute.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO reservations'));
    expect(insert[1]).toEqual([expect.any(String), 5, 3, '2026-10-26', '08:00:00', '09:00:00', 1, 800, 0, 800, 'confirmed', null]);
    expect(connection.execute.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO payments'))[1]).toEqual([7, 800, 'cash']);
    expect(connection.commit).toHaveBeenCalledTimes(1);
  });

  test('rolls back the booking if its initial payment record cannot be saved', async () => {
    const execute = connection.execute.getMockImplementation();
    connection.execute.mockImplementation(async (...args) => {
      if (args[0].startsWith('INSERT INTO payments')) throw new Error('Ledger storage unavailable');
      return execute(...args);
    });
    await expect(Reservation.createReservation(booking)).rejects.toThrow('Ledger storage unavailable');
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  test('rejects paid add-ons before opening any transaction', async () => {
    getConnection.mockClear();
    booking.services = [{ service_id: 1, quantity: 4 }];
    await expect(Reservation.createReservation(booking)).rejects.toThrow('Additional services cannot be booked');
    expect(getConnection).not.toHaveBeenCalled();
  });

  test.each(['2026-02-30', '2026-10-26T08:00:00', 'invalid'])('rejects an invalid booking date %s', async (date) => {
    booking.reservationDate = date;
    await expect(Reservation.createReservation(booking)).rejects.toThrow(/valid reservation date/);
  });

  test('rejects yesterday and dates beyond the configured advance period', async () => {
    booking.reservationDate = '2026-10-24';
    await expect(Reservation.createReservation(booking)).rejects.toThrow('within the next 30 days');
    booking.reservationDate = '2026-11-25';
    await expect(Reservation.createReservation(booking)).rejects.toThrow('within the next 30 days');
  });

  test('checks past times in facility time rather than execution host time', async () => {
    booking.reservationDate = '2026-10-25';
    booking.startTime = '07:00'; booking.endTime = '08:00';
    await expect(Reservation.createReservation(booking)).rejects.toThrow('start time has already passed');
  });

  test('enforces minimum and maximum duration from settings', async () => {
    booking.endTime = '08:30';
    await expect(Reservation.createReservation(booking)).rejects.toThrow('between 1 and 4 hours');
    booking.endTime = '13:00';
    await expect(Reservation.createReservation(booking)).rejects.toThrow('between 1 and 4 hours');
  });

  test('rejects slots that start outside the configured interval', async () => {
    booking.startTime = '08:30'; booking.endTime = '09:30';
    await expect(Reservation.createReservation(booking)).rejects.toThrow('60-minute time slots');
  });

  test('honors the configured duration and advance window rather than hardcoded UI limits', async () => {
    settings.max_booking_duration = '2'; settings.booking_advance_days = '5';
    booking.endTime = '11:00';
    await expect(Reservation.createReservation(booking)).rejects.toThrow('between 1 and 2 hours');
    booking.endTime = '09:00'; booking.reservationDate = '2026-10-31';
    await expect(Reservation.createReservation(booking)).rejects.toThrow('within the next 5 days');
  });

  test('does not release an occupied court time when a prior booking has completed check-in', async () => {
    conflicts = [{ id: 99, status: 'completed' }];
    await expect(Reservation.createReservation(booking)).rejects.toThrow('no longer available');
    const lock = connection.execute.mock.calls.find(([sql]) => sql.includes('FROM reservations') && sql.includes('FOR UPDATE'))[0];
    expect(lock).toContain("'completed'");
    expect(connection.commit).not.toHaveBeenCalled();
  });
});
