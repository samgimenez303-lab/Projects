export const formatMoney = (amount = 0) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', minimumFractionDigits: 2,
}).format(Number(amount) || 0);

export const localDate = (date = new Date()) => [
  date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0'),
].join('-');

export const facilityClock = (date = new Date(), timeZone) => {
  if (!timeZone) return { date: localDate(date), time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}` };
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}` };
};

export const addCalendarDays = (date, days) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export const readBookingPolicy = (data) => {
  if (!data) return null;
  const policy = {
    advanceDays: Number(data.booking_advance_days), minHours: Number(data.min_booking_duration),
    maxHours: Number(data.max_booking_duration), interval: Number(data.booking_slot_interval),
    timeZone: data.business_timezone,
  };
  if (!Number.isInteger(policy.advanceDays) || policy.advanceDays < 0 || !Number.isFinite(policy.minHours) || policy.minHours <= 0 ||
      !Number.isFinite(policy.maxHours) || policy.maxHours < policy.minHours || ![30, 60].includes(policy.interval) || !policy.timeZone) return null;
  try { facilityClock(new Date(), policy.timeZone); } catch { return null; }
  return policy;
};

export const bookingDurations = (policy) => {
  if (!policy) return [];
  const options = [];
  for (let length = Math.ceil(policy.minHours * 60 / policy.interval) * policy.interval; length <= policy.maxHours * 60; length += policy.interval) options.push(length / 60);
  return options;
};

export const displayDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
};

const minutes = (time) => {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time || '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
};
const clockTime = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

// Require every interval in a multi-hour session to be available on the server.
export const buildBookingSlots = (availability, duration, date, now = new Date()) => {
  if (!Array.isArray(availability?.slots) || availability.reason || !(duration > 0)) return [];
  const policy = readBookingPolicy(availability);
  if (policy && !bookingDurations(policy).includes(Number(duration))) return [];
  const current = facilityClock(now, policy?.timeZone);
  const open = minutes(availability.open_time);
  const close = minutes(availability.close_time);
  return availability.slots.map((slot) => {
    const start = minutes(slot.start_time);
    const end = start + Number(duration) * 60;
    let cursor = start;
    const intervals = availability.slots
      .filter((item) => item.is_available && minutes(item.end_time) > start && minutes(item.start_time) < end)
      .sort((a, b) => minutes(a.start_time) - minutes(b.start_time));
    for (const interval of intervals) {
      if (minutes(interval.start_time) > cursor) break;
      cursor = Math.max(cursor, minutes(interval.end_time));
    }
    return { time: clockTime(start), endTime: clockTime(end),
      isAvailable: Number.isFinite(start) && start >= open && end <= close && cursor >= end &&
        (date > current.date || (date === current.date && `${clockTime(start)}:00` > current.time)) };
  });
};

export const paymentSummary = (reservation, payments = reservation?.payments || []) => {
  const unique = [...new Map(payments.map((payment) => [payment.id, payment])).values()];
  const paid = unique.filter((payment) => payment.payment_status === 'verified')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const latest = unique[0] || null;
  const due = Math.max(0, Number(reservation?.total_price || 0) - paid);
  return { paid, due, latest, canPay: ['pending', 'confirmed'].includes(reservation?.status) && due > 0 && latest?.payment_status !== 'submitted' };
};
