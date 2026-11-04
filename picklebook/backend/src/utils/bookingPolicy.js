const BOOKING_SETTINGS_SQL = "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('booking_advance_days', 'min_booking_duration', 'max_booking_duration', 'booking_slot_interval', 'require_admin_approval')";
const invalid = (message) => Object.assign(new Error(message), { statusCode: 400 });

const parseBookingPolicy = (rows) => {
  const settings = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
  const read = (key, fallback) => settings[key] === undefined ? fallback : Number(settings[key]);
  const policy = {
    booking_advance_days: read('booking_advance_days', 30),
    min_booking_duration: read('min_booking_duration', 1),
    max_booking_duration: read('max_booking_duration', 4),
    booking_slot_interval: read('booking_slot_interval', 60),
    business_timezone: process.env.BUSINESS_TIMEZONE || 'Asia/Manila'
  };
  if (!Number.isInteger(policy.booking_advance_days) || policy.booking_advance_days < 0 || policy.booking_advance_days > 365) throw invalid('The booking advance setting must be between 0 and 365 days. Please contact the front desk.');
  if (!Number.isFinite(policy.min_booking_duration) || !Number.isFinite(policy.max_booking_duration) || policy.min_booking_duration <= 0 || policy.max_booking_duration < policy.min_booking_duration || policy.max_booking_duration > 24) throw invalid('The facility booking duration settings are invalid. Please contact the front desk.');
  if (![30, 60].includes(policy.booking_slot_interval)) throw invalid('The facility booking slot interval must be 30 or 60 minutes. Please contact the front desk.');
  try { new Intl.DateTimeFormat('en', { timeZone: policy.business_timezone }); } catch { throw invalid('The facility time zone is invalid. Please contact the front desk.'); }
  return { policy, requireApproval: settings.require_admin_approval === 'true' };
};

const facilityNow = (timeZone = process.env.BUSINESS_TIMEZONE || 'Asia/Manila') => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const part = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return { date: `${part.year}-${part.month}-${part.day}`, time: `${part.hour}:${part.minute}:${part.second}` };
};

const parseBookingDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid('Choose a valid reservation date in YYYY-MM-DD format.');
  const day = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value) throw invalid('Choose a valid reservation date.');
  return day;
};

module.exports = { BOOKING_SETTINGS_SQL, parseBookingPolicy, facilityNow, parseBookingDate };
