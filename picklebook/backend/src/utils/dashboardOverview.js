const { facilityNow } = require('./bookingPolicy');

const resolveOverviewPeriod = (requestedMonth, timeZone = process.env.BUSINESS_TIMEZONE || 'Asia/Manila') => {
  const today = facilityNow(timeZone).date;
  const month = requestedMonth === undefined ? today.slice(0, 7) : requestedMonth;
  // These bounds match MySQL DATE's supported calendar years.
  if (typeof month !== 'string' || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)) {
    throw Object.assign(new Error('Choose a valid month in YYYY-MM format.'), { statusCode: 400 });
  }
  const [year, number] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { month, time_zone: timeZone, today, start_date: `${month}-01`, end_date: `${month}-${String(lastDay).padStart(2, '0')}` };
};

// At most one result row per court crosses the database boundary. Payments are
// summed by reservation before joining, without payment-verification history.
const MONTHLY_COURT_FINANCE_SQL = `
  SELECT c.id AS court_id, c.name AS court_name,
    COALESCE(SUM(CASE WHEN r.status IN ('confirmed', 'completed') THEN r.total_price ELSE 0 END), 0) AS expected_income,
    COALESCE(SUM(CASE WHEN r.status IN ('confirmed', 'completed') THEN LEAST(r.total_price, COALESCE(p.verified_amount, 0)) ELSE 0 END), 0) AS verified_income,
    COALESCE(SUM(CASE WHEN r.status IN ('confirmed', 'completed') THEN GREATEST(r.total_price - COALESCE(p.verified_amount, 0), 0) ELSE 0 END), 0) AS outstanding_income,
    COALESCE(SUM(CASE WHEN r.status = 'pending' THEN r.total_price ELSE 0 END), 0) AS pending_approval_value,
    COALESCE(SUM(CASE WHEN r.status IN ('confirmed', 'completed') THEN 1 ELSE 0 END), 0) AS confirmed_bookings,
    COALESCE(SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_approval_bookings,
    COALESCE(SUM(CASE WHEN r.status IN ('confirmed', 'completed') THEN r.duration_hours ELSE 0 END), 0) AS booked_hours
  FROM courts c
  LEFT JOIN reservations r ON r.court_id = c.id
    AND r.reservation_date >= ? AND r.reservation_date <= ?
    AND r.status IN ('pending', 'confirmed', 'completed')
  LEFT JOIN (
    SELECT payment.reservation_id, SUM(payment.amount) AS verified_amount
    FROM payments payment
    JOIN reservations booked ON booked.id = payment.reservation_id
    WHERE payment.payment_status = 'verified'
      AND booked.reservation_date >= ? AND booked.reservation_date <= ?
      AND booked.status IN ('confirmed', 'completed')
    GROUP BY payment.reservation_id
  ) p ON p.reservation_id = r.id
  GROUP BY c.id, c.name, c.sort_order
  ORDER BY confirmed_bookings DESC, expected_income DESC, c.sort_order ASC, c.id ASC
`;

const ACTIVE_PAYMENT_FILTER = `r.status IN ('pending', 'confirmed')
  AND ((p.payment_method = 'gcash' AND p.payment_status = 'submitted')
    OR (p.payment_method = 'cash' AND p.payment_status = 'pending'))
  AND NOT EXISTS (
    SELECT 1 FROM payments settled
    WHERE settled.reservation_id = r.id AND settled.payment_status IN ('verified', 'refunded')
  )`;

const ATTENTION_SQL = `
  SELECT
    COALESCE(SUM(CASE WHEN p.payment_method = 'gcash' AND p.payment_status = 'submitted' THEN 1 ELSE 0 END), 0) AS payment_verifications,
    COALESCE(SUM(CASE WHEN p.payment_method = 'cash' AND p.payment_status = 'pending' THEN 1 ELSE 0 END), 0) AS cash_collections,
    (SELECT COUNT(*) FROM reservations WHERE status = 'pending') AS pending_reservations,
    (SELECT COUNT(*) FROM contact_inquiries WHERE status = 'new') AS new_inquiries
  FROM payments p
  JOIN reservations r ON r.id = p.reservation_id
  WHERE ${ACTIVE_PAYMENT_FILTER}
`;

const PAYMENT_QUEUE_SQL = `
  SELECT p.*, r.reference_number, r.reservation_date, r.start_time, r.end_time,
    r.status AS reservation_status, COALESCE(u.name, r.walk_in_name) AS user_name, u.email AS user_email, c.name AS court_name
  FROM payments p
  JOIN reservations r ON r.id = p.reservation_id
  LEFT JOIN users u ON u.id = r.user_id
  JOIN courts c ON c.id = r.court_id
  WHERE ${ACTIVE_PAYMENT_FILTER}
  ORDER BY CASE WHEN p.payment_status = 'submitted' THEN 0 ELSE 1 END,
    r.reservation_date ASC, r.start_time ASC, p.created_at ASC, p.id ASC
  LIMIT 6
`;

const TODAY_SCHEDULE_SQL = `
  SELECT r.id, r.reference_number, r.court_id, r.reservation_date, r.start_time, r.end_time,
    r.status, r.total_price, r.duration_hours, COALESCE(u.name, r.walk_in_name) AS user_name, c.name AS court_name
  FROM reservations r
  LEFT JOIN users u ON u.id = r.user_id
  JOIN courts c ON c.id = r.court_id
  WHERE r.reservation_date = ? AND r.status IN ('pending', 'confirmed', 'completed')
  ORDER BY r.start_time ASC, r.id ASC
  LIMIT 8
`;

const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const amount = (value) => Math.round(numeric(value) * 100) / 100;
const financeFields = ['expected_income', 'verified_income', 'outstanding_income', 'pending_approval_value'];

const summarizeCourtFinance = (rows) => {
  const cents = Object.fromEntries(financeFields.map((field) => [field, 0]));
  const finance = { confirmed_bookings: 0, pending_approval_bookings: 0 };
  const court_activity = rows.map((row) => {
    financeFields.forEach((field) => { cents[field] += Math.round(numeric(row[field]) * 100); });
    finance.confirmed_bookings += numeric(row.confirmed_bookings);
    finance.pending_approval_bookings += numeric(row.pending_approval_bookings);
    return {
      court_id: numeric(row.court_id), court_name: row.court_name,
      booking_count: numeric(row.confirmed_bookings), booked_hours: amount(row.booked_hours),
      expected_income: amount(row.expected_income)
    };
  });
  financeFields.forEach((field) => { finance[field] = cents[field] / 100; });
  return { finance, court_activity };
};

const buildOverview = (period, courts, attentionRows, queue, schedule) => ({
  month: period.month, time_zone: period.time_zone, today: period.today,
  ...summarizeCourtFinance(courts),
  attention: Object.fromEntries(['payment_verifications', 'cash_collections', 'pending_reservations', 'new_inquiries']
    .map((field) => [field, numeric(attentionRows[0]?.[field])])),
  payment_queue: queue.map((payment) => ({ ...payment, amount: amount(payment.amount) })),
  today_schedule: schedule.map((booking) => ({ ...booking, total_price: amount(booking.total_price), duration_hours: numeric(booking.duration_hours) }))
});

module.exports = {
  resolveOverviewPeriod, summarizeCourtFinance, buildOverview,
  MONTHLY_COURT_FINANCE_SQL, ATTENTION_SQL, PAYMENT_QUEUE_SQL, TODAY_SCHEDULE_SQL
};
