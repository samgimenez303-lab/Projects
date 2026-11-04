const { pool } = require('../config/db');
const Reservation = require('../models/Reservation');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { sendResponse } = require('../utils/helpers');

/**
 * Get daily schedule of all courts for front-desk staff
 */
const getDailySchedule = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // Fetch all active courts
    const [courts] = await pool.execute(
      'SELECT id, name, court_type, price_per_hour FROM courts WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    );

    // Fetch reservations for this date
    const [reservations] = await pool.execute(
      `SELECT r.*,
        COALESCE(u.name, r.walk_in_name) as user_name, u.email as user_email, COALESCE(u.phone, r.walk_in_phone) as user_phone,
        p.id as payment_id, p.payment_status, p.payment_method, p.transaction_reference
       FROM reservations r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN payments p ON p.id = (
         SELECT MAX(latest.id) FROM payments latest WHERE latest.reservation_id = r.id
       )
       WHERE r.reservation_date = ? AND r.status IN ('pending', 'confirmed', 'completed')
       ORDER BY r.start_time ASC`,
      [date]
    );

    // Group reservations by court
    const courtSchedules = courts.map((court) => {
      const courtBookings = reservations.filter(r => r.court_id === court.id);
      return {
        ...court,
        reservations: courtBookings
      };
    });

    return sendResponse(res, 200, {
      success: true,
      data: {
        date,
        total_reservations: reservations.length,
        courts: courtSchedules
      }
    });
  } catch (error) {
    console.error('Get daily schedule error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve daily court schedule.'
    });
  }
};

/**
 * Check-in reservation at court reception
 */
const checkInReservation = async (req, res) => {
  try {
    const reservationId = parseInt(req.params.id, 10);
    const reservation = await Reservation.findById(reservationId);

    if (!reservation) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Reservation not found.'
      });
    }

    if (reservation.status !== 'confirmed') {
      return sendResponse(res, 400, {
        success: false,
        message: 'Only confirmed reservations can be checked in.'
      });
    }

    const payments = await Payment.findByReservation(reservationId);
    if (!payments.some((payment) => payment.payment_status === 'verified' && Number(payment.amount) === Number(reservation.total_price))) {
      return sendResponse(res, 409, { success: false, message: 'Collect and verify the full court payment before check-in.' });
    }

    const checkInNote = `Checked in by ${req.user.name} at ${new Date().toLocaleTimeString()}`;
    const newNotes = reservation.notes ? `${reservation.notes} | ${checkInNote}` : checkInNote;

    // Set status to completed (or keep confirmed with check-in noted)
    const updated = await Reservation.updateStatus(reservationId, 'completed', newNotes);

    await AuditLog.log({
      userId: req.user.id,
      action: 'player_check_in',
      entityType: 'reservation',
      entityId: reservationId,
      details: { checked_in_by: req.user.name },
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'Player checked in successfully.',
      data: { reservation: updated }
    });
  } catch (error) {
    console.error('Check-in error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to process check-in.'
    });
  }
};

/**
 * Quick shift statistics for staff dashboard
 */
const getQuickStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toTimeString().split(' ')[0];

    // Total today
    const [todayCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM reservations WHERE reservation_date = ? AND status != "cancelled"',
      [today]
    );

    // Active now: date is today, start_time <= nowTime, end_time >= nowTime
    const [activeNow] = await pool.execute(
      `SELECT COUNT(*) as count FROM reservations
       WHERE reservation_date = ? AND start_time <= ? AND end_time >= ? AND status = 'confirmed'`,
      [today, nowTime, nowTime]
    );

    // Pending payments to verify
    const [pendingPayments] = await pool.execute(
      "SELECT COUNT(*) as count FROM payments WHERE payment_status = 'submitted'"
    );

    return sendResponse(res, 200, {
      success: true,
      data: {
        today_reservations: todayCount[0].count,
        currently_playing: activeNow[0].count,
        submitted_payments_to_verify: pendingPayments[0].count
      }
    });
  } catch (error) {
    console.error('Staff quick stats error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve quick shift stats.'
    });
  }
};

/**
 * Record cash payment collected at reception counter
 */
const markCashPaymentCollected = async (req, res) => {
  try {
    const { reservation_id, amount, notes } = req.body;

    const reservation = await Reservation.findById(reservation_id);
    if (!reservation) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Reservation not found.'
      });
    }

    const payment = await Payment.create({
      reservation_id,
      amount,
      payment_method: 'cash',
      payment_status: 'verified',
      verified_by_user_id: req.user.id,
      notes: notes ? `Cash collected by ${req.user.name}. ${notes}` : `Cash collected by ${req.user.name}.`
    });

    const sideEffects = await Promise.allSettled([Notification.create({
      userId: reservation.user_id,
      title: 'Payment Received (Cash)',
      message: `Cash payment of ₱${Number(payment.amount).toFixed(2)} received at the counter for reservation ${reservation.reference_number}.`,
      type: 'success',
      link: `/reservations/${reservation.id}`
    }), AuditLog.log({
      userId: req.user.id,
      action: 'counter_cash_collected',
      entityType: 'payment',
      entityId: payment.id,
      details: { reservation_id, amount: payment.amount },
      ipAddress: req.ip
    })]);
    if (sideEffects.some((result) => result.status === 'rejected')) console.error('Cash payment notification or audit entry could not be recorded.');

    return sendResponse(res, 201, {
      success: true,
      message: 'Cash payment recorded and reservation confirmed.',
      data: { payment }
    });
  } catch (error) {
    console.error('Mark cash payment error:', error);
    return sendResponse(res, error.statusCode || 500, {
      success: false,
      message: error.statusCode ? error.message : 'Failed to record cash payment.'
    });
  }
};

module.exports = {
  getDailySchedule,
  checkInReservation,
  getQuickStats,
  markCashPaymentCollected
};
