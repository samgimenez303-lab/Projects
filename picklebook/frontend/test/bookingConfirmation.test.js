import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingEmailNotice, savedBookingForRoute } from '../src/utils/bookingConfirmation.js';

test('a saved booking remains available only for its matching details route', () => {
  const reservation = { id: 17, reference_number: 'PB-17', total_price: 800 };
  assert.equal(savedBookingForRoute('17', { booked: true, savedReservation: reservation }), reservation);
  assert.equal(savedBookingForRoute('18', { booked: true, savedReservation: reservation }), null);
  assert.equal(savedBookingForRoute('17', { booked: false, savedReservation: reservation }), null);
  assert.equal(savedBookingForRoute('17', null), null);
});

test('mail status distinguishes real sending, preview, failure and unconfirmed delivery', () => {
  assert.match(bookingEmailNotice({ status: 'sent', receipt_attached: true }), /printable booking receipt attached/);
  assert.doesNotMatch(bookingEmailNotice({ status: 'sent', receipt_attached: false }), /attached/);
  assert.match(bookingEmailNotice({ status: 'simulated' }), /no email was sent/);
  assert.match(bookingEmailNotice({ status: 'failed' }), /reservation is saved.*couldn’t send/);
  assert.match(bookingEmailNotice({ status: 'unconfirmed' }), /not confirmed yet/);
  assert.match(bookingEmailNotice(undefined), /status is unavailable/);
});
