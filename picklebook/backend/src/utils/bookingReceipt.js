const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

const cleanText = (value) => String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim();
const money = (cents) => `PHP ${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const toCents = (amount) => {
  const number = Number(amount);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : 0;
};

const reservationLink = (reservationId, frontendUrl) => {
  let url;
  try {
    url = new URL(frontendUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid frontend URL');
  } catch { url = new URL('http://localhost:5173'); }
  url.search = '';
  url.hash = '';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/reservations/${encodeURIComponent(String(reservationId))}`;
  return url.href;
};

const bookingReceiptData = (name, reservation, frontendUrl) => {
  const totalCents = toCents(reservation.total_price);
  const payments = Array.isArray(reservation.payments) ? reservation.payments : [];
  // Joined verification history must never count the same payment more than once.
  const unique = [...new Map(payments.map((payment, index) => [payment.id ?? `unidentified-${index}`, payment])).values()];
  const paidCents = unique.filter((payment) => payment.payment_status === 'verified')
    .reduce((sum, payment) => sum + toCents(payment.amount), 0);
  const dueCents = Math.max(0, totalCents - paidCents);
  const isPaid = totalCents > 0 && paidCents >= totalCents;
  const paymentStatus = isPaid ? 'Paid - verified by staff'
    : unique.some((payment) => payment.payment_status === 'submitted') ? 'Payment pending - awaiting staff verification'
      : unique.some((payment) => payment.payment_status === 'refunded') ? 'Refund recorded - check your account for current balance'
        : 'Payment pending';
  const statuses = { pending: 'Pending approval', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', rejected: 'Rejected' };
  const status = statuses[reservation.status] || 'Saved - check your account for status';
  const reference = cleanText(reservation.reference_number || `Booking-${reservation.id}`);
  const customer = cleanText(name || reservation.user_name || 'Player');
  const court = cleanText(reservation.court_name || `Court #${reservation.court_id}`);
  const date = cleanText(reservation.reservation_date);
  const time = `${cleanText(reservation.start_time).slice(0, 5)} - ${cleanText(reservation.end_time).slice(0, 5)}`;
  const methods = [...new Set(unique.map((payment) => payment.payment_method).filter((method) => ['cash', 'gcash'].includes(method)))];
  const method = methods.map((value) => value === 'gcash' ? 'GCash' : 'Cash at the counter').join(', ') || 'See your reservation';
  const title = isPaid ? 'Payment receipt' : 'Booking receipt';
  const note = isPaid ? 'This receipt records payments verified by staff.'
    : 'This is a booking receipt, not proof of payment. Payment is marked paid only after staff verification.';
  const bookingNote = reservation.status === 'pending'
    ? 'Your reservation has been saved and is awaiting approval.'
    : reservation.status === 'confirmed' ? 'Your reservation has been saved and confirmed.'
      : `Your reservation is saved. Current booking status: ${status}.`;
  return {
    title, reference, customer, court, date, time, status, paymentStatus, note, bookingNote,
    url: reservationLink(reservation.id, frontendUrl),
    rows: [
      ['Booking reference', reference], ['Customer', customer], ['Court', court],
      ['Date', date], ['Time (facility local time)', time], ['Booking status', status],
      ['Booking total', money(totalCents)], ['Verified payments', money(paidCents)],
      ['Balance due', money(dueCents)], ['Payment status', paymentStatus], ['Payment method', method]
    ]
  };
};

const receiptTable = (data) => data.rows.map(([label, value]) => `<tr><th scope="row" style="text-align:left;vertical-align:top;padding:11px 0;border-bottom:1px solid #e3e9df;color:#647468;font-size:13px;font-weight:normal;width:43%">${escapeHtml(label)}</th><td style="vertical-align:top;padding:11px 0;border-bottom:1px solid #e3e9df;color:#12372a;font-size:13px;font-weight:bold;word-break:break-word">${escapeHtml(value)}</td></tr>`).join('');

const printableHtml = (data) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(data.title)} - ${escapeHtml(data.reference)}</title>
<style>body{margin:0;background:#f5f7f0;font:15px Arial,sans-serif;color:#12372a}.receipt{max-width:680px;margin:32px auto;padding:36px;background:white;border:1px solid #dce5d7;border-radius:16px}h1{font-size:28px;margin:12px 0}.brand{font-weight:bold;letter-spacing:2px;font-size:13px}.status{padding:12px;background:#edf3e4;border-radius:8px}table{width:100%;border-collapse:collapse;margin:24px 0}.note{font-size:13px;color:#526354;line-height:1.7}a{color:#27553d;word-break:break-all}@media(max-width:600px){.receipt{margin:0;padding:24px;border:0;border-radius:0}}@media print{body{background:white}.receipt{margin:0;padding:0;border:0;border-radius:0;max-width:none}a{color:inherit;text-decoration:none}@page{margin:18mm}}</style></head>
<body><main class="receipt"><p class="brand">PICKLEBOOK</p><h1>${escapeHtml(data.title)}</h1><p>Thank you for choosing PickleBook, ${escapeHtml(data.customer)}.</p><p>${escapeHtml(data.bookingNote)}</p><p class="status">${escapeHtml(data.paymentStatus)}</p><table aria-label="Reservation receipt">${receiptTable(data)}</table><p class="note">${escapeHtml(data.note)}</p><p class="note">View your booking and current status: <a href="${escapeHtml(data.url)}">${escapeHtml(data.url)}</a></p><p class="note">Keep this copy for your records. Use your browser's Print command to print or save it as a PDF.</p></main></body></html>`;

// Standard PDF fonts support WinAnsi characters. Other scripts use the UTF-8
// printable HTML attachment instead, preserving every customer's original name.
const winAnsiExtras = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85],
  [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
  [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92],
  [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c],
  [0x017e, 0x9e], [0x0178, 0x9f]
]);
const winAnsiBytes = (text) => {
  const bytes = [];
  for (const character of text) {
    const code = character.codePointAt(0);
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) bytes.push(code);
    else if (winAnsiExtras.has(code)) bytes.push(winAnsiExtras.get(code));
    else return null;
  }
  return Buffer.from(bytes);
};

// Conservative width keeps even wide Helvetica glyphs inside the printable area.
const wrapLine = (text, limit = 44) => {
  const lines = [];
  let remaining = text;
  while (remaining.length > limit) {
    let split = remaining.lastIndexOf(' ', limit);
    if (split < limit / 2) split = limit;
    lines.push(remaining.slice(0, split));
    remaining = remaining.slice(split).trimStart();
  }
  lines.push(remaining);
  return lines;
};

const receiptPdf = (data) => {
  const lines = [
    `Thank you for choosing PickleBook, ${data.customer}.`, data.bookingNote, '',
    ...data.rows.map(([label, value]) => `${label}: ${value}`), '', data.note,
    'View and manage your reservation online using the link below.'
  ].flatMap((line) => wrapLine(line));
  if (!winAnsiBytes(data.title) || lines.some((line) => !winAnsiBytes(line))) return null;
  // Keep exceptional long data in an unrestricted, printable HTML receipt.
  if (lines.length > 36) return null;
  const text = (value, x, y, size = 11, font = 'F1') => `BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm <${winAnsiBytes(value).toString('hex')}> Tj ET\n`;
  let stream = 'q 0.071 0.216 0.165 rg 0 748 595 94 re f Q\n1 1 1 rg\n';
  stream += text('PICKLEBOOK', 42, 800, 12, 'F2');
  stream += text(data.title, 42, 769, 24, 'F2');
  stream += '0.071 0.216 0.165 rg\n';
  let y = 719;
  for (const line of lines) { stream += text(line, 42, y); y -= 17; }
  stream += text('Open your reservation', 42, 55, 11, 'F2');
  const uri = data.url.replace(/[\\()]/g, '\\$&');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R /Annots [7 0 R] >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}endstream`,
    `<< /Type /Annot /Subtype /Link /Rect [40 50 220 68] /Border [0 0 0] /A << /S /URI /URI (${uri}) >> >>`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
};

const buildBookingEmail = (name, reservation, frontendUrl) => {
  const data = bookingReceiptData(name, reservation, frontendUrl);
  const gameReminder = "Don't forget your upcoming game. We look forward to seeing you on the court!";
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fbfcf7;border:1px solid #dce5d7;border-radius:16px;overflow:hidden"><div style="padding:28px 32px;background:#12372a;color:white"><p style="font-size:12px;letter-spacing:2px;color:#c7f36b;font-weight:bold;margin:0 0 16px">PICKLEBOOK</p><h1 style="font-size:28px;line-height:1.2;margin:0;color:#ffffff">Thank you for choosing PickleBook!</h1></div><div style="padding:28px 32px"><p>Hello ${escapeHtml(data.customer)},</p><p style="line-height:1.7">${escapeHtml(data.bookingNote)} Your printable ${data.title.toLowerCase()} is attached.</p><p style="line-height:1.7">${escapeHtml(gameReminder)}</p><p style="padding:12px;background:#edf3e4;border-radius:8px;font-size:13px;font-weight:bold;color:#12372a">${escapeHtml(data.paymentStatus)}</p><table style="width:100%;border-collapse:collapse;margin:20px 0" aria-label="Your booking details">${receiptTable(data)}</table><p style="font-size:13px;color:#526354;line-height:1.7">${escapeHtml(data.note)}</p><p style="margin:26px 0"><a href="${escapeHtml(data.url)}" style="display:inline-block;padding:14px 24px;background:#c7f36b;color:#12372a;border-radius:30px;font-weight:bold;text-decoration:none">View your reservation</a></p><p style="font-size:12px;line-height:1.7;color:#526354">Sign in to see your latest booking and payment status. If the button does not work, open:<br><a href="${escapeHtml(data.url)}" style="color:#27553d;word-break:break-all">${escapeHtml(data.url)}</a></p><p style="font-size:13px;color:#526354">See you on the court!<br>The PickleBook team</p></div></div>`;
  const plainText = [
    'Thank you for choosing PickleBook!', `Hello ${data.customer},`, '', data.bookingNote,
    `Your printable ${data.title.toLowerCase()} is attached.`, '', gameReminder, '', data.title,
    ...data.rows.map(([label, value]) => `${label}: ${value}`), '', data.note,
    '', `View your reservation: ${data.url}`, 'Sign in to see the latest booking and payment status.',
    '', 'See you on the court!', 'The PickleBook team'
  ].join('\n');
  const filename = `PickleBook-${data.reference.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 72) || 'booking'}-receipt`;
  const pdf = receiptPdf(data);
  return {
    subject: `Thank you for choosing PickleBook - ${data.reference}`,
    html, text: plainText,
    attachments: [{
      filename: `${filename}.${pdf ? 'pdf' : 'html'}`,
      content: pdf || Buffer.from(printableHtml(data), 'utf8'),
      contentType: pdf ? 'application/pdf' : 'text/html; charset=utf-8',
      contentDisposition: 'attachment'
    }]
  };
};

module.exports = { buildBookingEmail, bookingReceiptData };
