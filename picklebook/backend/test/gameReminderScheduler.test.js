jest.mock('../src/models/GameReminder', () => ({ GameReminder: {
  findCandidates: jest.fn(), claim: jest.fn(), currentReservation: jest.fn(), finishEmail: jest.fn()
} }));
jest.mock('../src/config/email', () => ({ sendGameReminderEmail: jest.fn() }));

const { GameReminder } = require('../src/models/GameReminder');
const { sendGameReminderEmail } = require('../src/config/email');
const { runGameReminders, startGameReminders } = require('../src/services/gameReminders');
const { reservationStartMs, reminderMinutes, reminderDates } = require('../src/utils/reminderTime');

describe('Facility-local reminder timing', () => {
  const booking = { reservation_date: '2026-11-04', start_time: '00:30:00' };
  test('finds a game one hour away across the facility midnight and UTC date boundary', () => {
    const now = new Date('2026-11-03T15:30:00Z');
    expect(reminderDates(now, 'Asia/Manila')).toEqual(['2026-11-03', '2026-11-04']);
    expect(reminderMinutes(booking, now, 'Asia/Manila')).toBe(60);
    expect(reservationStartMs(booking.reservation_date, booking.start_time, 'Asia/Manila'))
      .toBe(Date.parse('2026-11-03T16:30:00Z'));
  });
  test('never reminds early, after the start, or at the exact start', () => {
    expect(reminderMinutes(booking, new Date('2026-11-03T15:29:59Z'), 'Asia/Manila')).toBeNull();
    expect(reminderMinutes(booking, new Date('2026-11-03T16:30:00Z'), 'Asia/Manila')).toBeNull();
    expect(reminderMinutes(booking, new Date('2026-11-03T16:31:00Z'), 'Asia/Manila')).toBeNull();
    expect(reminderMinutes(booking, new Date('2026-11-03T16:00:01Z'), 'Asia/Manila')).toBe(30);
  });
  test('handles daylight-saving gaps and folds without guessing nonexistent times', () => {
    expect(Number.isNaN(reservationStartMs('2026-03-08', '02:30:00', 'America/New_York'))).toBe(true);
    expect(reservationStartMs('2026-11-01', '01:30:00', 'America/New_York'))
      .toBe(Date.parse('2026-11-01T05:30:00Z'));
    expect(reminderMinutes({ reservation_date: '2026-03-08', start_time: '03:30:00' },
      new Date('2026-03-08T06:30:00Z'), 'America/New_York')).toBe(60);
  });
  test.each([['2026-02-30', '12:00:00'], ['2026-11-04', '24:30:00'], ['bad', '08:00']])('invalid schedule %s %s is never eligible', (date, time) => {
    expect(Number.isNaN(reservationStartMs(date, time, 'Asia/Manila'))).toBe(true);
  });
});

describe('Durable reminder dispatch and scheduler lifecycle', () => {
  const now = new Date('2026-11-03T15:30:00Z');
  const reservation = { id: 7, user_id: 5, user_email: 'player@example.test', status: 'confirmed' };
  const claim = { reservation, key: [7, '2026-11-04', '00:30:00'], shouldEmail: true, notificationCreated: true };
  const logger = { error: jest.fn() };
  const options = { clock: () => now, timeZone: 'Asia/Manila', logger };
  beforeEach(() => {
    jest.clearAllMocks();
    GameReminder.findCandidates.mockResolvedValue([{ id: 7 }]);
    GameReminder.claim.mockResolvedValue(claim);
    GameReminder.currentReservation.mockResolvedValue({ reservation, minutesUntilStart: 60 });
    GameReminder.finishEmail.mockResolvedValue(undefined);
    sendGameReminderEmail.mockResolvedValue({ success: true, status: 'sent' });
  });
  afterEach(() => { jest.useRealTimers(); });

  test('delivers only a durably claimed reminder, then records SMTP acceptance', async () => {
    const counts = await runGameReminders(options);
    expect(GameReminder.claim).toHaveBeenCalledWith(7, now, 'Asia/Manila');
    expect(sendGameReminderEmail).toHaveBeenCalledWith(reservation, { minutesUntilStart: 60, timeZone: 'Asia/Manila' });
    expect(GameReminder.claim.mock.invocationCallOrder[0]).toBeLessThan(sendGameReminderEmail.mock.invocationCallOrder[0]);
    expect(GameReminder.finishEmail).toHaveBeenCalledWith(claim.key, 'sent', null);
    expect(counts).toMatchObject({ notifications: 1, sent: 1, simulated: 0 });
  });
  test('does not send for ineligible bookings or a previously claimed email', async () => {
    GameReminder.claim.mockResolvedValueOnce(null);
    await runGameReminders(options);
    GameReminder.claim.mockResolvedValueOnce({ ...claim, shouldEmail: false, notificationCreated: false });
    await runGameReminders(options);
    expect(sendGameReminderEmail).not.toHaveBeenCalled();
  });
  test('rechecks cancellation and account state immediately before SMTP', async () => {
    GameReminder.currentReservation.mockResolvedValue(null);
    await runGameReminders(options);
    expect(sendGameReminderEmail).not.toHaveBeenCalled();
    expect(GameReminder.finishEmail).toHaveBeenCalledWith(claim.key, 'failed', 'BOOKING_INELIGIBLE');
  });
  test('uses the current recipient and actual remaining minutes for late confirmation or restart catch-up', async () => {
    const current = { ...reservation, user_email: 'updated@example.test' };
    GameReminder.currentReservation.mockResolvedValue({ reservation: current, minutesUntilStart: 25 });
    await runGameReminders(options);
    expect(sendGameReminderEmail).toHaveBeenCalledWith(current, { minutesUntilStart: 25, timeZone: 'Asia/Manila' });
  });
  test('email failure never removes the existing in-app reminder or prevents other bookings being processed', async () => {
    GameReminder.findCandidates.mockResolvedValue([{ id: 7 }, { id: 8 }]);
    sendGameReminderEmail.mockResolvedValueOnce({ success: false, status: 'failed' });
    const counts = await runGameReminders(options);
    expect(counts).toMatchObject({ notifications: 2, sent: 1, failed: 1 });
    expect(sendGameReminderEmail).toHaveBeenCalledTimes(2);
  });
  test('preview mode is recorded as simulated, never sent', async () => {
    sendGameReminderEmail.mockResolvedValue({ success: true, status: 'simulated' });
    expect(await runGameReminders(options)).toMatchObject({ sent: 0, simulated: 1 });
    expect(GameReminder.finishEmail).toHaveBeenCalledWith(claim.key, 'simulated', null);
  });
  test('bounds an unknown SMTP result and handles a later rejection without reattempting it', async () => {
    jest.useFakeTimers();
    let rejectEmail;
    sendGameReminderEmail.mockReturnValue(new Promise((resolve, reject) => { rejectEmail = reject; }));
    const run = runGameReminders(options);
    await jest.advanceTimersByTimeAsync(20000);
    expect(await run).toMatchObject({ unconfirmed: 1, sent: 0 });
    expect(GameReminder.finishEmail).toHaveBeenCalledWith(claim.key, 'unconfirmed', expect.any(String));
    rejectEmail(new Error('SMTP connection lost'));
    await jest.advanceTimersByTimeAsync(0);
    expect(sendGameReminderEmail).toHaveBeenCalledTimes(1);
    expect(GameReminder.finishEmail).toHaveBeenCalledTimes(1);
  });
  test('a storage failure cannot send mail before its durable claim', async () => {
    GameReminder.claim.mockRejectedValue(Object.assign(new Error('Storage unavailable'), { code: 'ER_LOCK_DEADLOCK' }));
    await runGameReminders(options);
    expect(sendGameReminderEmail).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('ER_LOCK_DEADLOCK'));
  });
  test('polls immediately and every minute, avoids overlapping passes, and stops cleanly', async () => {
    jest.useFakeTimers();
    let release;
    GameReminder.findCandidates.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    const stop = startGameReminders(options);
    expect(GameReminder.findCandidates).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(120000);
    expect(GameReminder.findCandidates).toHaveBeenCalledTimes(1);
    release([]);
    await jest.advanceTimersByTimeAsync(60000);
    expect(GameReminder.findCandidates).toHaveBeenCalledTimes(2);
    stop();
    await jest.advanceTimersByTimeAsync(120000);
    expect(GameReminder.findCandidates).toHaveBeenCalledTimes(2);
  });
  test('an initial database outage does not kill the worker or prevent a later recovery', async () => {
    jest.useFakeTimers();
    GameReminder.findCandidates.mockRejectedValueOnce(Object.assign(new Error('Missing table'), { code: 'ER_NO_SUCH_TABLE' }));
    const stop = startGameReminders(options);
    await jest.advanceTimersByTimeAsync(60000);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('db:migrate:reminders'));
    expect(sendGameReminderEmail).toHaveBeenCalledTimes(1);
    stop();
  });
});
