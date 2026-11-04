const { pool, getConnection } = require('../config/db');

const paymentError = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
const toCents = (amount) => {
  if (!/^\d+(\.\d{1,2})?$/.test(String(amount))) throw paymentError('Invalid payment amount.', 400);
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) throw paymentError('Payment amount must be greater than zero.', 400);
  return cents;
};

class Payment {
  /**
   * Find payment by ID with verification history and reservation info
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT p.*,
        r.reference_number, r.reservation_date, r.start_time, r.end_time, r.total_price as reservation_total,
        r.user_id, COALESCE(u.name, r.walk_in_name) as user_name, u.email as user_email, COALESCE(u.phone, r.walk_in_phone) as user_phone,
        c.name as court_name
       FROM payments p
       JOIN reservations r ON p.reservation_id = r.id
       LEFT JOIN users u ON r.user_id = u.id
       JOIN courts c ON r.court_id = c.id
       WHERE p.id = ?`,
      [id]
    );

    if (rows.length === 0) return null;
    const payment = rows[0];

    // Verification records
    const [verifications] = await pool.execute(
      `SELECT pv.*, u.name as verified_by_name
       FROM payment_verifications pv
       LEFT JOIN users u ON pv.verified_by = u.id
       WHERE pv.payment_id = ?
       ORDER BY pv.created_at DESC`,
      [id]
    );
    payment.verifications = verifications;

    return payment;
  }

  /**
   * Find payments for a specific reservation
   */
  static async findByReservation(reservationId) {
    const [rows] = await pool.execute(
      `SELECT p.*, pv.action as verification_action, pv.notes as verification_notes, u.name as verified_by_name
       FROM payments p
       LEFT JOIN payment_verifications pv ON pv.id = (
         SELECT MAX(latest.id) FROM payment_verifications latest WHERE latest.payment_id = p.id
       )
       LEFT JOIN users u ON pv.verified_by = u.id
       WHERE p.reservation_id = ?
       ORDER BY p.created_at DESC`,
      [reservationId]
    );
    return rows;
  }

  /**
   * Create a payment record
   */
  static async create({
    reservation_id,
    amount,
    payment_method = 'cash',
    transaction_reference = null,
    notes = null,
    payment_status = 'pending',
    verified_by_user_id = null
  }) {
    if (!['cash', 'gcash'].includes(payment_method)) throw paymentError('Choose cash or GCash.', 400);
    if (!['pending', 'submitted', 'verified'].includes(payment_status)) throw paymentError('Invalid initial payment status.', 400);
    if (payment_status === 'verified' && (!verified_by_user_id || payment_method !== 'cash')) {
      throw paymentError('Cash collection must be recorded by staff.', 403);
    }
    if (payment_status === 'submitted' && payment_method !== 'gcash') throw paymentError('Cash payments remain pending until collected.', 400);
    const reference = transaction_reference ? String(transaction_reference).trim().toUpperCase() : null;
    if (payment_method === 'gcash' && payment_status === 'submitted' && !/^[A-Z0-9-]{6,100}$/.test(reference || '')) {
      throw paymentError('Enter a valid GCash reference of 6 to 100 letters, numbers or hyphens.', 400);
    }
    const connection = await getConnection();
    let paymentId;
    try {
      await connection.beginTransaction();
      // The reservation lock serializes all payment mutations for this booking.
      const [reservations] = await connection.execute('SELECT id, status, total_price FROM reservations WHERE id = ? FOR UPDATE', [reservation_id]);
      const reservation = reservations[0];
      if (!reservation) throw paymentError('Reservation not found.', 404);
      if (!['pending', 'confirmed'].includes(reservation.status)) throw paymentError('Payments cannot be changed for this reservation status.');
      const totalCents = toCents(reservation.total_price);
      if (amount !== undefined && toCents(amount) !== totalCents) throw paymentError('Payment amount must equal the reservation total.', 400);
      const [existing] = await connection.execute('SELECT id, payment_status, payment_method, transaction_reference FROM payments WHERE reservation_id = ? ORDER BY id DESC FOR UPDATE', [reservation_id]);
      if (existing.some((payment) => ['verified', 'refunded'].includes(payment.payment_status))) {
        throw paymentError('This reservation already has a settled payment. Contact the front desk for adjustments.');
      }
      const active = existing.filter((payment) => ['pending', 'submitted'].includes(payment.payment_status));
      if (active.length > 1) throw paymentError('Multiple payment records require review by the front desk.');
      const current = active[0] || existing[0];
      if (current?.payment_status === 'submitted') {
        if (payment_status === 'submitted' && current.payment_method === 'gcash' && current.transaction_reference === reference) {
          await connection.commit();
          return this.findById(current.id);
        }
        throw paymentError('A submitted payment is awaiting staff verification.');
      }
      if (reference) {
        const [duplicates] = await connection.execute('SELECT id FROM payments WHERE transaction_reference = ? AND reservation_id <> ? LIMIT 1', [reference, reservation_id]);
        if (duplicates.length) throw paymentError('This transaction reference has already been used.');
      }
      const values = [reservation.total_price, payment_method, payment_status, reference, payment_status === 'pending' ? null : new Date(), notes];
      if (current) {
        paymentId = current.id;
        await connection.execute('UPDATE payments SET amount = ?, payment_method = ?, payment_status = ?, transaction_reference = ?, payment_date = ?, notes = ? WHERE id = ?', [...values, paymentId]);
      } else {
        const [result] = await connection.execute('INSERT INTO payments (amount, payment_method, payment_status, transaction_reference, payment_date, notes, reservation_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [...values, reservation_id]);
        paymentId = result.insertId;
      }
      if (payment_status === 'verified') {
        await connection.execute("INSERT INTO payment_verifications (payment_id, verified_by, action, notes) VALUES (?, ?, 'verified', ?)", [paymentId, verified_by_user_id, notes]);
        await connection.execute("UPDATE reservations SET status = 'confirmed' WHERE id = ? AND status = 'pending'", [reservation_id]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') throw paymentError('This transaction reference has already been used.');
      throw error;
    } finally {
      connection.release();
    }
    return this.findById(paymentId);
  }

  /**
   * Submit GCash reference number for an existing or new payment
   */
  static async submitGcashReference(reservationId, transactionReference) {
    return this.create({ reservation_id: reservationId, payment_method: 'gcash', payment_status: 'submitted', transaction_reference: transactionReference });
  }

  /**
   * Verify or reject a payment (admin / staff action)
   */
  static async verifyPayment(paymentId, verifiedByUserId, action, notes = null) {
    if (!['verified', 'rejected'].includes(action)) throw paymentError('Invalid verification action.', 400);
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      // Always lock reservation before payments, matching create() to avoid deadlocks.
      const [lookup] = await connection.execute('SELECT reservation_id FROM payments WHERE id = ?', [paymentId]);
      if (!lookup.length) throw paymentError('Payment not found.', 404);
      const [reservations] = await connection.execute('SELECT id, status, total_price FROM reservations WHERE id = ? FOR UPDATE', [lookup[0].reservation_id]);
      const reservation = reservations[0];
      if (!reservation || !['pending', 'confirmed'].includes(reservation.status)) throw paymentError('Payments cannot be verified for this reservation status.');
      const [paymentRows] = await connection.execute('SELECT id, reservation_id, payment_status, payment_method, amount FROM payments WHERE reservation_id = ? FOR UPDATE', [reservation.id]);
      const payment = paymentRows.find((row) => Number(row.id) === Number(paymentId));
      if (!payment) throw paymentError('Payment not found.', 404);
      if (!['pending', 'submitted'].includes(payment.payment_status)) throw paymentError('This payment has already been reviewed.');
      if (payment.payment_method !== 'cash' && payment.payment_status !== 'submitted') throw paymentError('Submit the GCash reference before verification.');
      if (paymentRows.some((row) => Number(row.id) !== Number(paymentId) && ['verified', 'refunded'].includes(row.payment_status))) throw paymentError('This reservation already has a settled payment.');
      if (toCents(payment.amount) !== toCents(reservation.total_price)) throw paymentError('The payment does not match the reservation total.');
      const newStatus = action === 'verified' ? 'verified' : 'rejected';

      // 1. Update payment status
      await connection.execute(
        'UPDATE payments SET payment_status = ?, payment_date = COALESCE(payment_date, NOW()) WHERE id = ?',
        [newStatus, paymentId]
      );

      // 2. Insert payment verification record
      await connection.execute(
        `INSERT INTO payment_verifications (payment_id, verified_by, action, notes)
         VALUES (?, ?, ?, ?)`,
        [paymentId, verifiedByUserId, action, notes]
      );

      // 3. If verified, confirm reservation if currently pending
      if (action === 'verified') {
        await connection.execute(
          "UPDATE reservations SET status = 'confirmed' WHERE id = ? AND status = 'pending'",
          [payment.reservation_id]
        );
      }

      await connection.commit();
      return this.findById(paymentId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Query all payments with filters and pagination
   */
  static async findAll({
    page = 1,
    limit = 20,
    status = '',
    method = '',
    search = '',
    startDate = '',
    endDate = ''
  } = {}) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('p.payment_status = ?');
      params.push(status);
    }

    if (method) {
      conditions.push('p.payment_method = ?');
      params.push(method);
    }

    if (startDate) {
      conditions.push('p.created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('p.created_at <= ?');
      params.push(endDate);
    }

    if (search) {
      conditions.push('(r.reference_number LIKE ? OR p.transaction_reference LIKE ? OR COALESCE(u.name, r.walk_in_name) LIKE ? OR u.email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT p.*,
        r.reference_number, r.reservation_date, r.start_time, r.end_time, r.status as reservation_status,
        COALESCE(u.name, r.walk_in_name) as user_name, u.email as user_email,
        c.name as court_name
      FROM payments p
      JOIN reservations r ON p.reservation_id = r.id
      LEFT JOIN users u ON r.user_id = u.id
      JOIN courts c ON r.court_id = c.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.execute(sql, [...params, Number(limit), Number(offset)]);

    const countSql = `
      SELECT COUNT(*) as total
      FROM payments p
      JOIN reservations r ON p.reservation_id = r.id
      LEFT JOIN users u ON r.user_id = u.id
      JOIN courts c ON r.court_id = c.id
      ${whereClause}
    `;

    const [countRows] = await pool.execute(countSql, params);

    return {
      payments: rows,
      total: countRows[0].total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(countRows[0].total / limit)
    };
  }
}

module.exports = Payment;
