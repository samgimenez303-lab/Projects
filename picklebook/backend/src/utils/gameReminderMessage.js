const cleanText = (value) => String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim();
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

const reservationUrl = (link, frontendUrl) => {
  let url;
  try {
    url = new URL(frontendUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid frontend URL');
  } catch { url = new URL('http://localhost:5173'); }
  url.search = '';
  url.hash = '';
  url.pathname = `${url.pathname.replace(/\/$/, '')}${link}`;
  return url.href;
};

/** Build the same reminder for the notification bell and the customer's email. */
const buildGameReminderMessage = (reservation, {
  minutesUntilStart = 60,
  timeZone = process.env.BUSINESS_TIMEZONE || 'Asia/Manila',
  frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
} = {}) => {
  const value = Number(minutesUntilStart);
  const minutes = Number.isFinite(value) && value > 0 ? Math.ceil(value) : 60;
  const countdown = minutes === 60 ? '1 hour' : `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const title = `Your game starts in ${countdown}!`;
  const customer = cleanText(reservation.user_name || 'Player');
  const court = cleanText(reservation.court_name || 'your reserved court');
  const reference = cleanText(reservation.reference_number || `Booking-${reservation.id}`);
  // These fields are already facility-local values, not UTC timestamps.
  const date = cleanText(reservation.reservation_date);
  const time = cleanText(reservation.start_time).slice(0, 5);
  const zone = cleanText(timeZone);
  const link = `/reservations/${encodeURIComponent(String(reservation.id))}`;
  const url = reservationUrl(link, frontendUrl);
  const preparation = 'Bring your paddle, water, and court shoes, and arrive 10–15 minutes early.';
  const message = `Your game at ${court} starts in ${countdown} on ${date} at ${time} (${zone}). ${preparation} See you on the court!`;
  const subject = `Your PickleBook game starts in ${countdown} - ${reference}`;
  const details = [
    ['Booking reference', reference], ['Court', court], ['Date', date],
    ['Start time (facility local time)', time], ['Facility time zone', zone]
  ];
  const rows = details.map(([label, detail]) => `<tr><th scope="row" style="text-align:left;padding:10px 12px 10px 0;color:#526354;font-weight:normal">${escapeHtml(label)}</th><td style="padding:10px 0;font-weight:bold;color:#12372a">${escapeHtml(detail)}</td></tr>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #dce5d7;border-radius:16px;overflow:hidden"><div style="padding:28px 32px;background:#12372a;color:white"><p style="font-size:12px;letter-spacing:2px;color:#c7f36b;font-weight:bold">PICKLEBOOK</p><h1 style="font-size:28px;line-height:1.3;color:white">${escapeHtml(title)}</h1></div><div style="padding:28px 32px"><p>Hello ${escapeHtml(customer)},</p><p style="line-height:1.7">Your game at ${escapeHtml(court)} starts in ${escapeHtml(countdown)}. Get ready for your next rally!</p><table style="width:100%;border-collapse:collapse;margin:20px 0" aria-label="Your upcoming game">${rows}</table><p style="line-height:1.7">${escapeHtml(preparation)}</p><p style="margin:26px 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 24px;background:#c7f36b;color:#12372a;border-radius:30px;font-weight:bold;text-decoration:none">View reservation</a></p><p style="font-size:12px;line-height:1.7;color:#526354">Sign in to see your latest reservation details. If the button does not work, open:<br><a href="${escapeHtml(url)}" style="color:#27553d;word-break:break-all">${escapeHtml(url)}</a></p><p style="line-height:1.7">See you on the court!<br>The PickleBook team</p></div></div>`;
  const text = [
    title, '', `Hello ${customer},`, '',
    `Your game at ${court} starts in ${countdown}. Get ready for your next rally!`, '',
    ...details.map(([label, detail]) => `${label}: ${detail}`), '', preparation, '',
    `View reservation: ${url}`, 'Sign in to see your latest reservation details.', '',
    'See you on the court!', 'The PickleBook team'
  ].join('\n');
  return { title, message, link, subject, html, text };
};

module.exports = { buildGameReminderMessage };
