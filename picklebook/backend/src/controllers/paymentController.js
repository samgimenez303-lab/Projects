const Payment = require('../models/Payment');
const Reservation = require('../models/Reservation');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const { sendResponse } = require('../utils/helpers');
const { loadPaymentInstructions } = require('../utils/paymentInstructions');

const paymentFailure = (res, error, fallback) => sendResponse(res, error.statusCode || 500, {
  success: false,
  message: error.statusCode ? error.message : fallback
});

// A committed payment must stay successful if a notification or audit service fails.
const recordSideEffects = async (operations) => {
  const results = await Promise.allSettled(operations);
  if (results.some((result) => result.status === 'rejected')) console.error('A payment notification or audit entry could not be recorded.');
};

const getPaymentInstructions = async (req, res) => {
  try {
    return sendResponse(res, 200, { success: true, data: await loadPaymentInstructions() });
  } catch (error) {
    return paymentFailure(res, error, 'Payment instructions are temporarily unavailable. You can pay cash at the counter.');
  }
};

/**
 * Get all payments (Admin / Staff)
 */
const getAllPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      method,
      search,
      startDate,
      endDate
    } = req.query;

    const result = await Payment.findAll({
      page,
      limit,
      status,
      method,
      search,
      startDate,
      endDate
    });

    return sendResponse(res, 200, {
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get all payments error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve payments.'
    });
  }
};

/**
 * Get single payment by ID
 */
const getPaymentById = async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Payment record not found.'
      });
    }

    if (req.user.role === 'customer' && Number(payment.user_id) !== Number(req.user.id)) {
      return sendResponse(res, 403, {
        success: false,
        message: 'Access denied.'
      });
    }

    return sendResponse(res, 200, {
      success: true,
      data: { payment }
    });
  } catch (error) {
    console.error('Get payment by id error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve payment details.'
    });
  }
};

/**
 * Get payments for a specific reservation
 */
const getReservationPayments = async (req, res) => {
  try {
    const reservationId = parseInt(req.params.reservationId, 10);
    const reservation = await Reservation.findById(reservationId);

    if (!reservation) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Reservation not found.'
      });
    }

    if (req.user.role === 'customer' && Number(reservation.user_id) !== Number(req.user.id)) {
      return sendResponse(res, 403, {
        success: false,
        message: 'Access denied.'
      });
    }

    const payments = await Payment.findByReservation(reservationId);
    return sendResponse(res, 200, {
      success: true,
      data: { payments }
    });
  } catch (error) {
    console.error('Get reservation payments error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve payments for this reservation.'
    });
  }
};

/**
 * Create a new payment record (e.g. manual cash collection or online checkout initialization)
 */
const createPayment = async (req, res) => {
  try {
    const {
      reservation_id,
      amount,
      payment_method,
      transaction_reference,
      notes
    } = req.body;

    const reservation = await Reservation.findById(reservation_id);
    if (!reservation) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Reservation not found.'
      });
    }

    // Role check: customer can only pay for their own reservation
    if (req.user.role === 'customer' && Number(reservation.user_id) !== Number(req.user.id)) {
      return sendResponse(res, 403, {
        success: false,
        message: 'Access denied.'
      });
    }

    if (payment_method === 'gcash') {
      const instructions = await loadPaymentInstructions();
      if (!instructions.gcash.configured) return sendResponse(res, 409, { success: false, message: 'GCash is not configured yet. Please choose cash at the counter.' });
    }

    const isStaffOrAdmin = ['admin', 'staff'].includes(req.user.role);
    const initialStatus = payment_method === 'cash' ? (isStaffOrAdmin ? 'verified' : 'pending') : 'submitted';

    const payment = await Payment.create({
      reservation_id,
      amount,
      payment_method,
      transaction_reference: transaction_reference || null,
      notes: notes || null,
      payment_status: initialStatus,
      verified_by_user_id: isStaffOrAdmin ? req.user.id : null
    });

    await recordSideEffects([AuditLog.log({
      userId: req.user.id,
      action: 'payment_create',
      entityType: 'payment',
      entityId: payment.id,
      details: { reservation_id, amount: payment.amount, payment_method, status: initialStatus },
      ipAddress: req.ip
    })]);

    return sendResponse(res, 201, {
      success: true,
      message: 'Payment record created.',
      data: { payment }
    });
  } catch (error) {
    console.error('Create payment error:', error);
    return paymentFailure(res, error, 'Failed to create payment record.');
  }
};

/**
 * Submit GCash reference number (Customer payment submission)
 */
const submitGcashReference = async (req, res) => {
  try {
    const { reservation_id, transaction_reference } = req.body;

    const reservation = await Reservation.findById(reservation_id);
    if (!reservation) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Reservation not found.'
      });
    }

    if (req.user.role === 'customer' && Number(reservation.user_id) !== Number(req.user.id)) {
      return sendResponse(res, 403, {
        success: false,
        message: 'Access denied.'
      });
    }

    const instructions = await loadPaymentInstructions();
    if (!instructions.gcash.configured) return sendResponse(res, 409, { success: false, message: 'GCash is not configured yet. Please choose cash at the counter.' });
    const payment = await Payment.submitGcashReference(reservation_id, transaction_reference);

    // Notify user of submission
    await recordSideEffects([Notification.create({
      userId: reservation.user_id,
      title: 'GCash Payment Submitted',
      message: `Your payment reference ${transaction_reference} for reservation ${reservation.reference_number} has been submitted and is pending verification.`,
      type: 'info',
      link: `/reservations/${reservation.id}`
    }), AuditLog.log({
      userId: req.user.id,
      action: 'payment_gcash_submitted',
      entityType: 'payment',
      entityId: payment.id,
      details: { reservation_id, transaction_reference },
      ipAddress: req.ip
    })]);

    return sendResponse(res, 200, {
      success: true,
      message: 'GCash reference number submitted successfully. A staff member will verify your payment shortly.',
      data: { payment }
    });
  } catch (error) {
    console.error('Submit GCash reference error:', error);
    return paymentFailure(res, error, 'Failed to submit GCash payment reference.');
  }
};

/**
 * Verify or reject a payment (Staff / Admin)
 */
const verifyPayment = async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    const { action, notes } = req.body;

    const updatedPayment = await Payment.verifyPayment(
      paymentId,
      req.user.id,
      action,
      notes || null
    );

    // Fetch reservation to notify user
    const reservation = await Reservation.findById(updatedPayment.reservation_id);
    if (reservation) {
      await recordSideEffects([Notification.create({
        userId: reservation.user_id,
        title: action === 'verified' ? 'Payment Verified!' : 'Payment Issue / Rejected',
        message: action === 'verified'
          ? `Your payment for reservation ${reservation.reference_number} has been verified.`
          : `Your payment for reservation ${reservation.reference_number} could not be verified. ${notes || ''}`,
        type: action === 'verified' ? 'success' : 'error',
        link: `/reservations/${reservation.id}`
      })]);
    }

    await recordSideEffects([AuditLog.log({
      userId: req.user.id,
      action: `payment_${action}`,
      entityType: 'payment',
      entityId: paymentId,
      details: { action, notes },
      ipAddress: req.ip
    })]);

    return sendResponse(res, 200, {
      success: true,
      message: `Payment has been ${action}.`,
      data: { payment: updatedPayment }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    return paymentFailure(res, error, 'Failed to process payment verification.');
  }
};

module.exports = {
  getPaymentInstructions,
  getAllPayments,
  getPaymentById,
  getReservationPayments,
  createPayment,
  submitGcashReference,
  verifyPayment
};
