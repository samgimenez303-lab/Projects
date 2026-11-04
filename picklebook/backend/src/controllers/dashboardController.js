const { pool } = require('../config/db');
const { sendResponse } = require('../utils/helpers');
const {
  resolveOverviewPeriod, buildOverview,
  MONTHLY_COURT_FINANCE_SQL, ATTENTION_SQL, PAYMENT_QUEUE_SQL, TODAY_SCHEDULE_SQL
} = require('../utils/dashboardOverview');

/**
 * Monthly booked income and current operational work for administrators.
 * Existing stats/charts retain their historical contracts.
 */
const getDashboardOverview = async (req, res) => {
  try {
    const period = resolveOverviewPeriod(req.query.month);
    const [[courts], [attention], [queue], [schedule]] = await Promise.all([
      pool.execute(MONTHLY_COURT_FINANCE_SQL, [period.start_date, period.end_date, period.start_date, period.end_date]),
      pool.execute(ATTENTION_SQL),
      pool.execute(PAYMENT_QUEUE_SQL),
      pool.execute(TODAY_SCHEDULE_SQL, [period.today])
    ]);
    return sendResponse(res, 200, { success: true, data: buildOverview(period, courts, attention, queue, schedule) });
  } catch (error) {
    if (error.statusCode === 400) return sendResponse(res, 400, { success: false, message: error.message });
    console.error('Dashboard overview error:', error);
    return sendResponse(res, 500, { success: false, message: 'Failed to retrieve the dashboard overview.' });
  }
};

/**
 * Get dashboard key metrics and summary counts
 */
const getDashboardStats = async (req, res) => {
  try {
    // 1. Total customers
    const [customerRows] = await pool.execute(
      "SELECT COUNT(*) as total_customers FROM users WHERE role = 'customer'"
    );

    // 2. Total courts
    const [courtRows] = await pool.execute(
      'SELECT COUNT(*) as total_courts, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_courts FROM courts'
    );

    // 3. Today's reservations
    const [todayRows] = await pool.execute(
      'SELECT COUNT(*) as today_reservations FROM reservations WHERE reservation_date = CURDATE()'
    );

    // 4. Upcoming reservations
    const [upcomingRows] = await pool.execute(
      "SELECT COUNT(*) as upcoming_reservations FROM reservations WHERE reservation_date >= CURDATE() AND status IN ('pending', 'confirmed')"
    );

    // 5. Reservation status breakdown
    const [statusRows] = await pool.execute(
      `SELECT status, COUNT(*) as count
       FROM reservations
       GROUP BY status`
    );

    const statusCounts = {
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      completed: 0,
      rejected: 0
    };
    for (const r of statusRows) {
      if (statusCounts[r.status] !== undefined) {
        statusCounts[r.status] = r.count;
      }
    }

    // 6. Total revenue (from verified payments)
    const [revenueRows] = await pool.execute(
      "SELECT COALESCE(SUM(amount), 0) as total_revenue FROM payments WHERE payment_status = 'verified'"
    );

    // 7. Today's revenue
    const [todayRevenueRows] = await pool.execute(
      "SELECT COALESCE(SUM(amount), 0) as today_revenue FROM payments WHERE payment_status = 'verified' AND DATE(payment_date) = CURDATE()"
    );

    // 8. Pending payments needing action
    const [pendingPaymentRows] = await pool.execute(
      "SELECT COUNT(*) as pending_payments FROM payments WHERE payment_status IN ('pending', 'submitted')"
    );

    return sendResponse(res, 200, {
      success: true,
      data: {
        total_customers: customerRows[0].total_customers,
        total_courts: courtRows[0].total_courts,
        active_courts: courtRows[0].active_courts,
        today_reservations: todayRows[0].today_reservations,
        upcoming_reservations: upcomingRows[0].upcoming_reservations,
        pending_reservations: statusCounts.pending,
        confirmed_reservations: statusCounts.confirmed,
        cancelled_reservations: statusCounts.cancelled,
        completed_reservations: statusCounts.completed,
        rejected_reservations: statusCounts.rejected,
        total_revenue: parseFloat(revenueRows[0].total_revenue),
        today_revenue: parseFloat(todayRevenueRows[0].today_revenue),
        pending_payments: pendingPaymentRows[0].pending_payments
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve dashboard metrics.'
    });
  }
};

/**
 * Get dashboard charts data
 */
const getDashboardCharts = async (req, res) => {
  try {
    // 1. Reservations by day for the last 14 days
    const [reservationsByDay] = await pool.execute(
      `SELECT reservation_date as date, COUNT(*) as count
       FROM reservations
       WHERE reservation_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
       GROUP BY reservation_date
       ORDER BY reservation_date ASC`
    );

    // 2. Revenue over the last 6 months
    const [revenueByMonth] = await pool.execute(
      `SELECT DATE_FORMAT(payment_date, '%Y-%m') as month, COALESCE(SUM(amount), 0) as total
       FROM payments
       WHERE payment_status = 'verified' AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
       ORDER BY month ASC`
    );

    // 3. Popular courts (by total reservations)
    const [popularCourts] = await pool.execute(
      `SELECT c.name as court_name, COUNT(r.id) as reservation_count
       FROM courts c
       LEFT JOIN reservations r ON c.id = r.court_id
       GROUP BY c.id, c.name
       ORDER BY reservation_count DESC`
    );

    // 4. Status distribution
    const [statusDistribution] = await pool.execute(
      `SELECT status, COUNT(*) as count
       FROM reservations
       GROUP BY status`
    );

    return sendResponse(res, 200, {
      success: true,
      data: {
        reservations_by_day: reservationsByDay,
        revenue_by_month: revenueByMonth,
        popular_courts: popularCourts,
        status_distribution: statusDistribution
      }
    });
  } catch (error) {
    console.error('Dashboard charts error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve chart analytics.'
    });
  }
};

module.exports = {
  getDashboardOverview,
  getDashboardStats,
  getDashboardCharts
};
