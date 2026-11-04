const { Parser } = require('json2csv');
const { pool } = require('../config/db');
const { sendResponse } = require('../utils/helpers');

/**
 * Export reservations to CSV format
 */
const exportReservationsCSV = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const conditions = [];
    const params = [];

    if (startDate) {
      conditions.push('r.reservation_date >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('r.reservation_date <= ?');
      params.push(endDate);
    }

    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        r.reference_number as 'Reference Number',
        COALESCE(u.name, r.walk_in_name) as 'Customer Name',
        u.email as 'Customer Email',
        COALESCE(u.phone, r.walk_in_phone) as 'Customer Phone',
        c.name as 'Court Name',
        r.reservation_date as 'Date',
        r.start_time as 'Start Time',
        r.end_time as 'End Time',
        r.duration_hours as 'Duration (Hours)',
        r.court_price as 'Court Price',
        r.services_price as 'Services Price',
        r.total_price as 'Total Price',
        r.status as 'Status',
        r.created_at as 'Created At'
      FROM reservations r
      LEFT JOIN users u ON r.user_id = u.id
      JOIN courts c ON r.court_id = c.id
      ${whereClause}
      ORDER BY r.reservation_date DESC, r.start_time DESC
    `;

    const [rows] = await pool.execute(sql, params);

    const parser = new Parser();
    const csv = parser.parse(rows);

    const filename = `reservations-report-${new Date().toISOString().split('T')[0]}.csv`;
    res.header('Content-Type', 'text/csv');
    res.attachment(filename);
    return res.send(csv);
  } catch (error) {
    console.error('Export reservations CSV error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to generate reservations CSV report.'
    });
  }
};

/**
 * Export payments to CSV format
 */
const exportPaymentsCSV = async (req, res) => {
  try {
    const { startDate, endDate, status, method } = req.query;
    const conditions = [];
    const params = [];

    if (startDate) {
      conditions.push('p.created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('p.created_at <= ?');
      params.push(endDate);
    }

    if (status) {
      conditions.push('p.payment_status = ?');
      params.push(status);
    }

    if (method) {
      conditions.push('p.payment_method = ?');
      params.push(method);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        p.id as 'Payment ID',
        r.reference_number as 'Reservation Ref',
        COALESCE(u.name, r.walk_in_name) as 'Customer Name',
        u.email as 'Customer Email',
        p.amount as 'Amount (PHP)',
        p.payment_method as 'Payment Method',
        p.payment_status as 'Payment Status',
        p.transaction_reference as 'Transaction Reference',
        p.payment_date as 'Payment Date',
        p.created_at as 'Created At'
      FROM payments p
      JOIN reservations r ON p.reservation_id = r.id
      LEFT JOIN users u ON r.user_id = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
    `;

    const [rows] = await pool.execute(sql, params);

    const parser = new Parser();
    const csv = parser.parse(rows);

    const filename = `payments-report-${new Date().toISOString().split('T')[0]}.csv`;
    res.header('Content-Type', 'text/csv');
    res.attachment(filename);
    return res.send(csv);
  } catch (error) {
    console.error('Export payments CSV error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to generate payments CSV report.'
    });
  }
};

/**
 * Export user accounts to CSV format
 */
const exportUsersCSV = async (req, res) => {
  try {
    const sql = `
      SELECT
        id as 'User ID',
        name as 'Name',
        email as 'Email',
        role as 'Role',
        phone as 'Phone',
        email_verified as 'Email Verified',
        is_active as 'Active',
        last_login as 'Last Login',
        created_at as 'Joined Date'
      FROM users
      ORDER BY created_at DESC
    `;

    const [rows] = await pool.execute(sql);

    const parser = new Parser();
    const csv = parser.parse(rows);

    const filename = `users-report-${new Date().toISOString().split('T')[0]}.csv`;
    res.header('Content-Type', 'text/csv');
    res.attachment(filename);
    return res.send(csv);
  } catch (error) {
    console.error('Export users CSV error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to generate users CSV report.'
    });
  }
};

module.exports = {
  exportReservationsCSV,
  exportPaymentsCSV,
  exportUsersCSV
};
