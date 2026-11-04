import test from 'node:test';
import assert from 'node:assert/strict';
import { isUnreadNotification, notificationLink } from '../src/utils/notifications.js';

test('notification links retain internal reservation routes and queries', () => {
  assert.equal(notificationLink('/reservations/42'), '/reservations/42');
  assert.equal(notificationLink('/reservations/42?receipt=1#details'), '/reservations/42?receipt=1#details');
  assert.equal(notificationLink('/my-reservations'), '/my-reservations');
});

test('notification links cannot navigate to external sites or script URLs', () => {
  for (const link of ['https://example.com', '//example.com', '/\\example.com', 'javascript:alert(1)', 'data:text/html,test', '/\n/example.com', ' /reservations/42', null]) {
    assert.equal(notificationLink(link), null);
  }
});

test('notification read status accepts database numbers, booleans and strings', () => {
  for (const value of [0, false, '0']) assert.equal(isUnreadNotification({ is_read: value }), true);
  for (const value of [1, true, '1', undefined]) assert.equal(isUnreadNotification({ is_read: value }), false);
});
