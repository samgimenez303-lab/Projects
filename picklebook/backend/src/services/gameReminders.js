const { GameReminder } = require('../models/GameReminder');
const { sendGameReminderEmail } = require('../config/email');

const EMAIL_TIMEOUT_MS = 20000;

const deliverEmail = async (reservation, options) => {
  let timeout;
  try {
    return await Promise.race([
      Promise.resolve().then(() => sendGameReminderEmail(reservation, options))
        .catch(() => ({ success: false, status: 'unconfirmed' })),
      new Promise((resolve) => { timeout = setTimeout(() => resolve({ success: false, status: 'unconfirmed' }), EMAIL_TIMEOUT_MS); })
    ]);
  } finally {
    clearTimeout(timeout);
  }
};

const runGameReminders = async ({ clock = () => new Date(), timeZone = process.env.BUSINESS_TIMEZONE || 'Asia/Manila', logger = console } = {}) => {
  const candidates = await GameReminder.findCandidates(clock(), timeZone);
  const counts = { notifications: 0, sent: 0, simulated: 0, failed: 0, unconfirmed: 0 };
  for (const { id } of candidates) {
    try {
      const claim = await GameReminder.claim(id, clock(), timeZone);
      if (!claim) continue;
      if (claim.notificationCreated) counts.notifications++;
      if (!claim.shouldEmail) continue;
      // Recheck cancellation, rescheduling, account state and start time after
      // the claim commits, immediately before sending to the current account.
      const current = await GameReminder.currentReservation(claim, clock(), timeZone);
      if (!current) {
        await GameReminder.finishEmail(claim.key, 'failed', 'BOOKING_INELIGIBLE');
        continue;
      }
      const result = await deliverEmail(current.reservation, { minutesUntilStart: current.minutesUntilStart, timeZone });
      const status = result?.success && ['sent', 'simulated'].includes(result.status) ? result.status
        : result?.status === 'unconfirmed' ? 'unconfirmed' : 'failed';
      await GameReminder.finishEmail(claim.key, status, ['failed', 'unconfirmed'].includes(status) ? 'SMTP_DELIVERY_FAILED_OR_UNCERTAIN' : null);
      counts[status]++;
      if (status === 'failed' || status === 'unconfirmed') logger.error(`Game reminder email ${status} for reservation ${id}. Check SMTP settings.`);
    } catch (error) {
      // An interrupted SMTP attempt remains claimed, preventing a duplicate.
      logger.error(`Game reminder processing failed for reservation ${id} (${error.code || 'REMINDER_ERROR'}).`);
    }
  }
  return counts;
};

const startGameReminders = ({ intervalMs = 60000, logger = console, ...options } = {}) => {
  let running = false;
  let stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await runGameReminders({ ...options, logger });
    } catch (error) {
      const detail = error.code === 'ER_NO_SUCH_TABLE' ? 'Run npm.cmd run db:migrate:reminders.' : error.code || 'REMINDER_ERROR';
      logger.error(`Game reminders could not be checked (${detail}).`);
    } finally {
      running = false;
    }
  };
  const interval = setInterval(tick, intervalMs);
  interval.unref?.();
  void tick();
  return () => { stopped = true; clearInterval(interval); };
};

module.exports = { runGameReminders, startGameReminders };
