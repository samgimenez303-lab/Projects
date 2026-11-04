import test from 'node:test';
import assert from 'node:assert/strict';
import { loginDestination, portalPathForRole } from '../src/utils/navigation.js';

test('management sign-in goes to its portal when returning from customer booking pages', () => {
  for (const pathname of ['/book', '/courts', '/dashboard']) {
    assert.equal(loginDestination('admin', { pathname, search: '?court=1' }), '/admin');
    assert.equal(loginDestination('staff', { pathname }), '/staff');
  }
});

test('management sign-in preserves permitted portal deep links and excludes other roles', () => {
  assert.equal(loginDestination('admin', { pathname: '/admin/players', search: '?status=active' }), '/admin/players?status=active');
  assert.equal(loginDestination('admin', { pathname: '/staff' }), '/staff');
  assert.equal(loginDestination('staff', { pathname: '/admin/users' }), '/staff');
  assert.equal(loginDestination('admin', { pathname: '/administrator' }), '/admin');
});

test('players retain their customer return paths, including booking queries and receipt links', () => {
  assert.equal(loginDestination('customer', { pathname: '/book', search: '?court=2' }), '/book?court=2');
  assert.equal(loginDestination('customer', { pathname: '/reservations/42' }), '/reservations/42');
  assert.equal(loginDestination('customer'), '/dashboard');
});

test('sign-in rejects external return paths for every role', () => {
  for (const role of ['customer', 'staff', 'admin']) {
    assert.equal(loginDestination(role, { pathname: '//example.com' }), portalPathForRole(role));
    assert.equal(loginDestination(role, { pathname: 'https://example.com' }), portalPathForRole(role));
  }
});
