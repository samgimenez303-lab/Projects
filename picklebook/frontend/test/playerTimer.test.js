import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPlayerTimer, playerTimerStatus, remainingPlayerSeconds } from '../src/utils/playerTimer.js';

const running = { status: 'running', remaining_seconds: 120, timer_started_at: 100000 };

test('running countdown derives elapsed time from the server clock across reloads and background tabs', () => {
  assert.equal(remainingPlayerSeconds(running, 100000), 120);
  assert.equal(remainingPlayerSeconds(running, 130500), 90);
  assert.equal(remainingPlayerSeconds({ ...running }, 210000), 10);
  assert.equal(remainingPlayerSeconds(running, 400000), 0);
});

test('paused and waiting timers do not lose time and finished timers remain zero', () => {
  assert.equal(remainingPlayerSeconds({ ...running, status: 'paused' }, 900000), 120);
  assert.equal(remainingPlayerSeconds({ ...running, status: 'waiting', timer_started_at: null }, 900000), 120);
  assert.equal(remainingPlayerSeconds({ ...running, status: 'finished' }, 100000), 0);
  assert.equal(remainingPlayerSeconds({ ...running, status: 'paused', remaining_seconds: 31.25 }, 900000), 32);
  assert.equal(remainingPlayerSeconds({ ...running, remaining_seconds: 31.25 }, 100500), 31);
});

test('expiry changes display state without requiring a poll or allowing negative time', () => {
  assert.equal(playerTimerStatus(running, 219999), 'running');
  assert.equal(playerTimerStatus(running, 220000), 'finished');
  assert.equal(remainingPlayerSeconds(running, 999999), 0);
  assert.equal(remainingPlayerSeconds(running, 99000), 120);
});

test('timer formats minutes and hours with padded components', () => {
  assert.equal(formatPlayerTimer(0), '00:00');
  assert.equal(formatPlayerTimer(65), '01:05');
  assert.equal(formatPlayerTimer(3600), '1:00:00');
  assert.equal(formatPlayerTimer(43200), '12:00:00');
});
