const Reservation = require('../models/Reservation');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const { sendReservationConfirmationEmail } = require('../config/email');
const { sendResponse } = require('../utils/helpers');

/**
 * Create a new court reservation
 */
const createReservation = async (req, res) => {
  try {
    const {
      court_id,
      reservation_date,
      start_time,
      end_time,
      services = [],
      notes = null,
      payment_method = 'cash'
    } = req.body;

    const reservation = await Reservation.createReservation({
      userId: req.user.id,
      courtId: parseInt(court_id, 10),
      reservationDate: reservation_date,
      startTime: start_time,
      endTime: end_time,
      services,
      notes,
      paymentMethod: payment_method
    });

    // Create in-app notification for the user
    const sideEffects = await Promise.allSettled([Notification.create({
      userId: req.user.id,
      title: 'Reservation Placed',
      message: `Your reservation for ${reservation.court_name} on ${reservation.reservation_date} (${reservation.start_time} - ${reservation.end_time}) has been placed. Ref: ${reservation.reference_number}.`,
      type: 'info',
      link: `/reservations/${reservation.id}`
    }), AuditLog.log({
      userId: req.user.id,
      action: 'reservation_create',
      entityType: 'reservation',
      entityId: reservation.id,
      details: { reference_number: reservation.reference_number, total_price: reservation.total_price },
      ipAddress: req.ip
    })]);
    if (sideEffects.some((result) => result.status === 'rejected')) console.error('A reservation notification or audit entry could not be recorded.');

    // The booking is already committed. An email outage must never turn it
    // into a failed checkout or encourage the customer to book it again.
    let emailDelivery = { status: 'failed', recipient: req.user.email, receipt_attached: false };
    let emailTimer;
    try {
      const emailAttempt = Promise.resolve()
        .then(() => sendReservationConfirmationEmail(req.user.email, req.user.name, reservation))
        .then((result) => ({
          status: result?.success && ['sent', 'simulated'].includes(result.status) ? result.status : 'failed',
          recipient: req.user.email,
          receipt_attached: result?.success === true && result.receipt_attached === true
        }))
        .catch(() => {
          console.error('The saved reservation email could not be sent.');
          return { status: 'failed', recipient: req.user.email, receipt_attached: false };
        });
      emailDelivery = await Promise.race([
        emailAttempt,
        new Promise((resolve) => {
          emailTimer = setTimeout(() => resolve({ status: 'unconfirmed', recipient: req.user.email, receipt_attached: false }), 8000);
        })
      ]);
    } catch {
      console.error('The saved reservation email could not be prepared.');
    } finally {
      clearTimeout(emailTimer);
    }

    return sendResponse(res, 201, {
      success: true,
      message: 'Reservation created successfully!',
      data: { reservation, email_delivery: emailDelivery }
    });
  } catch (error) {
    console.error('Create reservation error:', error);
    return sendResponse(res, 400, {
      success: false,
      message: error.message || 'Failed to create reservation.'
    });
  }
};

/**
 * Get all reservations (Admin / Staff)
 */
const getAllReservations = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      courtId,
      userId,
      date,
      startDate,
      endDate,
      search
    } = req.query;

    const result = await Reservation.findAll({
      page,
      limit,
      status,
      courtId,
      userId,
      date,
      startDate,
      endDate,
      search
    });

    return sendResponse(res, 200, {
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get all reservations error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve reservations.'
    });
  }
};

/**
 * Get reservations for authenticated customer
 */
const getMyReservations = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const result = await Reservation.getUserReservations(req.user.id, {
      page,
      limit,
      status
    });

    return sendResponse(res, 200, {
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get my reservations error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve your reservations.'
    });
  }
};

/**
 * Get single reservation by ID
 */
const getReservationById = async (req, res) => {
  try {
    const reservationId = parseInt(req.params.id, 10);
    const reservation = await Reservation.findById(reservationId);

    if (!reservation) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Reservation not found.'
      });
    }

    // Role check: customer can only view their own
    if (req.user.role === 'customer' && reservation.user_id !== req.user.id) {
      return sendResponse(res, 403, {
        success: false,
        message: 'Access denied. You do not own this reservation.'
      });
    }

    return sendResponse(res, 200, {
      success: true,
      data: { reservation }
    });
  } catch (error) {
    console.error('Get reservation error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve reservation.'
    });
  }
};

/**
 * Get reservation by reference number (e.g. for receipt lookups)
 */
const getReservationByReference = async (req, res) => {
  try {
    const { reference } = req.params;
    const reservation = await Reservation.findByReference(reference);

    if (!reservation) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Reservation not found with this reference number.'
      });
    }

    // Check permissions
    if (req.user.role === 'customer' && reservation.user_id !== req.user.id) {
      return sendResponse(res, 403, {
        success: false,
        message: 'Access denied.'
      });
    }

    return sendResponse(res, 200, {
      success: true,
      data: { reservation }
    });
  } catch (error) {
    console.error('Get by reference error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve reservation.'
    });
  }
};

/**
 * Cancel a reservation
 */
const cancelReservation = async (req, res) => {
  try {
    const reservationId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const isAdminOrStaff = ['admin', 'staff'].includes(req.user.role);

    const cancelledReservation = await Reservation.cancelReservation(
      reservationId,
      req.user.id,
      reason,
      isAdminOrStaff
    );

    // Notify user
    if (cancelledReservation.user_id) await Notification.create({
      userId: cancelledReservation.user_id,
      title: 'Reservation Cancelled',
      message: `Reservation ${cancelledReservation.reference_number} has been cancelled.`,
      type: 'warning',
      link: `/reservations/${cancelledReservation.id}`
    });

    await AuditLog.log({
      userId: req.user.id,
      action: 'reservation_cancel',
      entityType: 'reservation',
      entityId: reservationId,
      details: { reason },
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'Reservation has been cancelled.',
      data: { reservation: cancelledReservation }
    });
  } catch (error) {
    console.error('Cancel reservation error:', error);
    return sendResponse(res, 400, {
      success: false,
      message: error.message || 'Failed to cancel reservation.'
    });
  }
};

/**
 * Update reservation status (Admin / Staff)
 */
const updateStatus = async (req, res) => {
  try {
    const reservationId = parseInt(req.params.id, 10);
    const { status, notes } = req.body;

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'rejected'];
    if (!validStatuses.includes(status)) {
      return sendResponse(res, 400, {
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updated = await Reservation.updateStatus(reservationId, status, notes);

    if (updated.user_id) await Notification.create({
      userId: updated.user_id,
      title: 'Reservation Status Updated',
      message: `Your reservation ${updated.reference_number} status is now ${status.toUpperCase()}.`,
      type: status === 'confirmed' ? 'success' : status === 'rejected' ? 'error' : 'info',
      link: `/reservations/${updated.id}`
    });

    await AuditLog.log({
      userId: req.user.id,
      action: 'reservation_status_update',
      entityType: 'reservation',
      entityId: reservationId,
      details: { status, notes },
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: `Reservation status updated to ${status}.`,
      data: { reservation: updated }
    });
  } catch (error) {
    console.error('Update status error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to update reservation status.'
    });
  }
};

module.exports = {
  createReservation,
  getAllReservations,
  getMyReservations,
  getReservationById,
  getReservationByReference,
  cancelReservation,
  updateStatus
};
