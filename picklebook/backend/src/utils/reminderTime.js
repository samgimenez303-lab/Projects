const HOUR_MS = 60 * 60 * 1000;

const localParts = (instant, timeZone) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
}).formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));

const partsEpoch = (parts) => Date.UTC(Number(parts.year), Number(parts.month) - 1,
  Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));

// Reservations store facility-local DATE/TIME, while the scheduler uses UTC.
// Sample both offsets around a clock change; a repeated local time uses its
// first occurrence, and a nonexistent local time is never sent a reminder.
const reservationStartMs = (date, time, timeZone) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) return NaN;
  const wall = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}Z`);
  if (!Number.isFinite(wall)) return NaN;
  const expected = `${date}T${time.slice(0, 5)}:${time.length === 8 ? time.slice(6) : '00'}`;
  if (new Date(wall).toISOString().slice(0, 19) !== expected) return NaN;
  const offsets = new Set([-86400000, 0, 86400000].map((shift) => {
    const sample = wall + shift;
    return partsEpoch(localParts(sample, timeZone)) - sample;
  }));
  const candidates = [...offsets].map((offset) => wall - offset)
    .filter((instant) => partsEpoch(localParts(instant, timeZone)) === wall);
  return candidates.length ? Math.min(...candidates) : NaN;
};

const reminderMinutes = (reservation, now, timeZone) => {
  const remaining = reservationStartMs(reservation.reservation_date, reservation.start_time, timeZone) - now.getTime();
  return remaining > 0 && remaining <= HOUR_MS ? Math.ceil(remaining / 60000) : null;
};

const reminderDates = (now, timeZone) => {
  const dates = [now.getTime(), now.getTime() + HOUR_MS].map((instant) => {
    const parts = localParts(instant, timeZone);
    return `${parts.year}-${parts.month}-${parts.day}`;
  }).sort();
  return dates;
};

module.exports = { HOUR_MS, reservationStartMs, reminderMinutes, reminderDates };
