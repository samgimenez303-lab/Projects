const { pool } = require('../config/db');
const Reservation = require('../models/Reservation');
const { sendResponse } = require('../utils/helpers');
const { loadPaymentInstructions } = require('../utils/paymentInstructions');

const bad = message => Object.assign(new Error(message), { statusCode: 400 });
const positiveId = value => ['number', 'string'].includes(typeof value) && /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value));
const validName = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 100;
const fields = new Set(['customer_id', 'customer_name', 'customer_phone', 'court_id', 'reservation_date', 'start_time', 'end_time', 'start_now', 'duration_hours', 'payment_method', 'transaction_reference', 'amount_received', 'payment_received', 'notes']);

const createWalkInReservation = async (req, res) => {
  try {
    const body = req.body || {};
    if (Object.keys(body).some(key => !fields.has(key))) throw bad('Use the customer, court, time, and received-payment fields from the front desk form.');
    if (!positiveId(body.court_id)) throw bad('Choose a valid court.');
    if (body.start_now !== undefined && typeof body.start_now !== 'boolean') throw bad('Choose immediate play or a scheduled start.');
    if (body.payment_received !== true) throw bad('Confirm that the full payment has been received before saving.');
    if (!['cash', 'gcash'].includes(body.payment_method)) throw bad('Choose cash or GCash for the received payment.');
    if (!['number', 'string'].includes(typeof body.amount_received) || !/^\d+(\.\d{1,2})?$/.test(String(body.amount_received)) || Number(body.amount_received) <= 0 || !Number.isSafeInteger(Math.round(Number(body.amount_received) * 100))) throw bad('Enter the full received amount with no more than two decimal places.');
    if (body.notes !== undefined && body.notes !== null && (typeof body.notes !== 'string' || body.notes.length > 2000)) throw bad('Notes must be no longer than 2000 characters.');
    const existingCustomer = body.customer_id !== undefined && body.customer_id !== null && body.customer_id !== '';
    if (existingCustomer && !positiveId(body.customer_id)) throw bad('Choose a valid customer account.');
    if (!existingCustomer && !validName(body.customer_name)) throw bad('Enter a customer name between 1 and 100 characters.');
    if (existingCustomer && body.customer_name !== undefined && body.customer_name !== null && (typeof body.customer_name !== 'string' || body.customer_name.trim())) throw bad('Choose an existing customer or enter a walk-in name, rather than both.');
    if (body.customer_phone !== undefined && body.customer_phone !== null && (typeof body.customer_phone !== 'string' || body.customer_phone.trim().length > 20)) throw bad('A customer phone number must be no longer than 20 characters.');
    if (body.start_now === true && (typeof body.duration_hours !== 'number' || !Number.isFinite(body.duration_hours) || body.duration_hours <= 0 || !Number.isInteger(body.duration_hours * 2))) throw bad('Choose a session duration in half-hour increments.');
    let transactionReference = null;
    if (body.payment_method === 'gcash') {
      if (typeof body.transaction_reference !== 'string' || !body.transaction_reference.trim() || body.transaction_reference.trim().length > 100) throw bad('Enter a GCash transaction reference between 1 and 100 characters.');
      const instructions = await loadPaymentInstructions();
      if (!instructions.gcash.configured) throw bad('GCash merchant details must be configured before recording a transfer.');
      transactionReference = body.transaction_reference.trim().toUpperCase();
    }
    const reservation = await Reservation.createReservation({
      userId: existingCustomer ? Number(body.customer_id) : null,
      courtId: Number(body.court_id), reservationDate: body.reservation_date,
      startTime: body.start_time, endTime: body.end_time,
      notes: body.notes?.trim() || null, paymentMethod: body.payment_method,
      counter: {
        operator: req.user, startNow: body.start_now === true,
        durationHours: body.duration_hours, amountReceived: body.amount_received,
        paymentReceived: true, transactionReference,
        customerName: existingCustomer ? null : body.customer_name.trim(),
        customerPhone: body.customer_phone?.trim() || null, ipAddress: req.ip
      }
    });
    return sendResponse(res, 201, {
      message: body.start_now === true ? 'Payment recorded. The customer is checked in and ready to play.' : 'Court reserved and payment recorded.',
      data: { reservation, payment: reservation.payments[0] }
    });
  } catch (error) {
    const missingSchema = ['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE', 'ER_BAD_NULL_ERROR'].includes(error.code);
    const status = error.statusCode || (missingSchema ? 503 : error.code ? 500 : 400);
    if (status === 500) console.error('Counter booking failed:', error.code || error.name);
    return sendResponse(res, status, {
      success: false,
      message: missingSchema ? 'Front desk booking storage needs an upgrade. Run npm run db:migrate:counter from backend.' : status === 500 ? 'The booking could not be saved. Check the schedule and payment history before trying again.' : error.message
    });
  }
};

const searchCustomers = async (req, res) => {
  if (typeof req.query.search !== 'string' || req.query.search.trim().length < 2 || req.query.search.trim().length > 100) return sendResponse(res, 400, { success: false, message: 'Enter between 2 and 100 characters to search customer accounts.' });
  try {
    const search = `%${req.query.search.trim()}%`;
    const [customers] = await pool.execute("SELECT id, name, email, phone FROM users WHERE role = 'customer' AND is_active = 1 AND (name LIKE ? OR email LIKE ? OR phone LIKE ?) ORDER BY name ASC, id ASC LIMIT 20", [search, search, search]);
    return sendResponse(res, 200, { data: { customers } });
  } catch (error) {
    console.error('Counter customer lookup failed:', error.code || error.name);
    return sendResponse(res, 500, { success: false, message: 'Customer accounts could not be loaded. A walk-in customer name can still be entered.' });
  }
};

module.exports = { createWalkInReservation, searchCustomers };
