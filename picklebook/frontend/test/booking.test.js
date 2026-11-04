import test from 'node:test';
import assert from 'node:assert/strict';
import { addCalendarDays, bookingDurations, buildBookingSlots, facilityClock, localDate, paymentSummary, readBookingPolicy } from '../src/utils/booking.js';

const schedule = {
  open_time: '08:00:00', close_time: '12:00:00',
  slots: [8, 9, 10, 11].map((hour) => ({ start_time: `${String(hour).padStart(2, '0')}:00`, end_time: `${String(hour + 1).padStart(2, '0')}:00`, is_available: hour !== 10 })),
};
const now = new Date('2026-10-25T07:00:00');

test('multi-hour sessions require every slot to be free and cannot extend after closing', () => {
  const slots = buildBookingSlots(schedule, 2, '2026-10-25', now);
  assert.deepEqual(slots.map((slot) => [slot.time, slot.isAvailable]), [['08:00', true], ['09:00', false], ['10:00', false], ['11:00', false]]);
});

test('unavailable API data and closures never produce bookable times', () => {
  assert.deepEqual(buildBookingSlots(null, 1, '2026-10-25', now), []);
  assert.deepEqual(buildBookingSlots({ ...schedule, reason: 'Closed for maintenance' }, 1, '2026-10-25', now), []);
});

test('a missing interval cannot be treated as an available multi-hour session', () => {
  const incomplete = { ...schedule, slots: schedule.slots.filter((slot) => slot.start_time !== '09:00') };
  assert.equal(buildBookingSlots(incomplete, 2, '2026-10-25', now)[0].isAvailable, false);
});

test('past times remain unavailable even when the server slot is free', () => {
  assert.equal(buildBookingSlots(schedule, 1, '2026-10-25', new Date('2026-10-25T08:30:00'))[0].isAvailable, false);
});

test('pending and submitted records never count as paid, and submitted blocks repeat payments', () => {
  const reservation = { status: 'confirmed', total_price: '800.00' };
  const pending = paymentSummary(reservation, [{ id: 1, amount: 800, payment_status: 'pending' }]);
  assert.equal(pending.paid, 0); assert.equal(pending.due, 800); assert.equal(pending.canPay, true);
  const submitted = paymentSummary(reservation, [{ id: 1, amount: 800, payment_status: 'submitted' }]);
  assert.equal(submitted.paid, 0); assert.equal(submitted.canPay, false);
});

test('duplicate verification joins count only once and closed reservations cannot be paid', () => {
  const payment = { id: 2, amount: '800.00', payment_status: 'verified' };
  assert.equal(paymentSummary({ status: 'confirmed', total_price: 800 }, [payment, payment]).paid, 800);
  assert.equal(paymentSummary({ status: 'cancelled', total_price: 800 }, []).canPay, false);
  assert.equal(paymentSummary({ status: 'rejected', total_price: 800 }, []).canPay, false);
});

test('unrecorded payment defaults to a balance due, never a paid receipt', () => {
  assert.deepEqual(paymentSummary({ status: 'pending', total_price: 500 }), { paid: 0, due: 500, latest: null, canPay: true });
  assert.equal(localDate(new Date(2026, 9, 25, 0, 15)), '2026-10-25');
});

test('custom booking policy controls advance window and half-hour duration options', () => {
  const policy = readBookingPolicy({ booking_advance_days: '60', min_booking_duration: '1.5', max_booking_duration: '3', booking_slot_interval: '30', business_timezone: 'Asia/Manila' });
  assert.equal(policy.advanceDays, 60);
  assert.deepEqual(bookingDurations(policy), [1.5, 2, 2.5, 3]);
  assert.equal(addCalendarDays('2026-12-20', policy.advanceDays), '2027-02-18');
});

test('policy can shorten the booking window and increase minimum duration', () => {
  const policy = readBookingPolicy({ booking_advance_days: 2, min_booking_duration: 2, max_booking_duration: 6, booking_slot_interval: 60, business_timezone: 'Asia/Manila' });
  assert.deepEqual(bookingDurations(policy), [2, 3, 4, 5, 6]);
  assert.equal(addCalendarDays('2026-10-25', policy.advanceDays), '2026-10-27');
  assert.equal(readBookingPolicy({ booking_advance_days: 30, min_booking_duration: 1, max_booking_duration: 4, booking_slot_interval: 15, business_timezone: 'Asia/Manila' }), null);
});

test('availability checks facility timezone rather than the visitor timezone', () => {
  const data = { ...schedule, booking_advance_days: 30, min_booking_duration: 1, max_booking_duration: 4, booking_slot_interval: 60, business_timezone: 'Asia/Manila' };
  const instant = new Date('2026-10-25T00:30:00Z');
  assert.deepEqual(facilityClock(instant, 'Asia/Manila'), { date: '2026-10-25', time: '08:30:00' });
  const slots = buildBookingSlots(data, 1, '2026-10-25', instant);
  assert.equal(slots[0].isAvailable, false);
  assert.equal(slots[1].isAvailable, true);
  assert.deepEqual(buildBookingSlots({ ...data, min_booking_duration: 2 }, 1, '2026-10-25', instant), []);
});
