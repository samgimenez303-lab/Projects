const { pool, getConnection } = require('../config/db');
const { generateRefNumber, calculateDurationHours } = require('../utils/helpers');
const { BOOKING_SETTINGS_SQL, parseBookingPolicy, facilityNow, parseBookingDate } = require('../utils/bookingPolicy');

const normalizeTime = (value) => {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(value)) {
    throw new Error('Booking times must use HH:mm with whole minutes.');
  }
  return value.length === 5 ? `${value}:00` : value;
};
const minutesOfDay = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const counterError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const moneyCents = (value) => {
  if (!['string', 'number'].includes(typeof value) || !/^\d+(\.\d{1,2})?$/.test(String(value))) throw counterError('Enter the exact payment amount with no more than two decimal places.');
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) throw counterError('Payment amount must be greater than zero.');
  return cents;
};

class Reservation {
  /**
   * Find reservation by ID with court, user, services and payments
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT r.*,
        c.name as court_name, c.court_type, c.price_per_hour as court_rate,
        COALESCE(u.name, r.walk_in_name) as user_name, u.email as user_email, COALESCE(u.phone, r.walk_in_phone) as user_phone
       FROM reservations r
       JOIN courts c ON r.court_id = c.id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
      [id]
    );

    if (rows.length === 0) return null;
    const reservation = rows[0];

    // Get reservation services
    const [services] = await pool.execute(
      `SELECT rs.*, s.name as service_name, s.category as service_category
       FROM reservation_services rs
       JOIN services s ON rs.service_id = s.id
       WHERE rs.reservation_id = ?`,
      [id]
    );
    reservation.services = services;

    // Get payment records
    const [payments] = await pool.execute(
      `SELECT p.*, pv.action as verification_action, pv.notes as verification_notes,
        u.name as verified_by_name
       FROM payments p
       LEFT JOIN payment_verifications pv ON pv.id = (
         SELECT MAX(latest.id) FROM payment_verifications latest WHERE latest.payment_id = p.id
       )
       LEFT JOIN users u ON pv.verified_by = u.id
       WHERE p.reservation_id = ?
       ORDER BY p.created_at DESC, p.id DESC`,
      [id]
    );
    reservation.payments = payments;

    return reservation;
  }

  /**
   * Find reservation by reference number
   */
  static async findByReference(referenceNumber) {
    const [rows] = await pool.execute('SELECT id FROM reservations WHERE reference_number = ?', [referenceNumber]);
    if (rows.length === 0) return null;
    return this.findById(rows[0].id);
  }

  /**
   * Create a new reservation inside a transaction with row locking
   * to guarantee no double-booking occurs.
   */
  static async createReservation({
    userId,
    courtId,
    reservationDate,
    startTime,
    endTime,
    services = [],
    notes = null,
    paymentMethod = 'cash',
    counter = null
  }) {
    if (!Array.isArray(services) || services.length) throw new Error('Only indoor and outdoor court reservations are available. Additional services cannot be booked.');
    if (!['cash', 'gcash'].includes(paymentMethod)) throw new Error('Choose cash or GCash as the payment method.');
    if (counter && (!['admin', 'staff'].includes(counter.operator?.role) || !Number.isSafeInteger(counter.operator?.id) || counter.paymentReceived !== true)) throw counterError('Only reception staff can record a received counter payment.', 403);
    let bookingDay;
    let durationMinutes;
    if (counter?.startNow) {
      durationMinutes = Number(counter.durationHours) * 60;
      if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes % 30 !== 0) throw counterError('Choose a session duration in half-hour increments.');
    } else {
      bookingDay = parseBookingDate(reservationDate);
      startTime = normalizeTime(startTime);
      endTime = normalizeTime(endTime);
      durationMinutes = minutesOfDay(endTime) - minutesOfDay(startTime);
      if (durationMinutes <= 0) throw new Error('End time must be after start time on the same date.');
      if (durationMinutes % 30 !== 0) throw new Error('Booking duration must use half-hour increments.');
    }
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const [settingRows] = await connection.execute(BOOKING_SETTINGS_SQL);
      const { policy, requireApproval } = parseBookingPolicy(settingRows);
      const { booking_advance_days: advanceDays, min_booking_duration: minHours, max_booking_duration: maxHours, booking_slot_interval: interval } = policy;
      const now = facilityNow(policy.business_timezone);
      if (counter?.startNow) {
        reservationDate = now.date;
        startTime = `${now.time.slice(0, 5)}:00`;
        const endMinutes = minutesOfDay(startTime) + durationMinutes;
        if (endMinutes >= 1440) throw counterError('A pay-and-play session must finish before midnight.');
        endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}:00`;
        bookingDay = parseBookingDate(reservationDate);
      }
      const dayDifference = (bookingDay.getTime() - Date.parse(`${now.date}T00:00:00Z`)) / 86400000;
      if (dayDifference < 0 || dayDifference > advanceDays) throw new Error(`Choose a booking date within the next ${advanceDays} days.`);
      if (!counter?.startNow && reservationDate === now.date && startTime <= now.time) throw new Error('The selected start time has already passed.');
      if (durationMinutes < minHours * 60 || durationMinutes > maxHours * 60) throw new Error(`Reservations must last between ${minHours} and ${maxHours} hours.`);

      // 1. Lock and fetch the court to ensure active and get price_per_hour
      const [courtRows] = await connection.execute(
        'SELECT id, name, price_per_hour, is_active FROM courts WHERE id = ? FOR UPDATE',
        [courtId]
      );

      if (courtRows.length === 0) {
        throw new Error('Court not found.');
      }

      const court = courtRows[0];
      if (!court.is_active) {
        throw new Error('Court is currently inactive.');
      }

      // 2. Validate operating hours and closures
      const dateObj = new Date(`${reservationDate}T00:00:00Z`);
      const dayOfWeek = dateObj.getUTCDay();

      const [hoursRows] = await connection.execute(
        'SELECT open_time, close_time, is_closed FROM court_operating_hours WHERE court_id = ? AND day_of_week = ?',
        [courtId, dayOfWeek]
      );

      if (hoursRows.length === 0 || hoursRows[0].is_closed) {
        throw new Error('Court is closed on this day of the week.');
      }

      const { open_time, close_time } = hoursRows[0];
      if (startTime < open_time || endTime > close_time) {
        throw new Error(`Reservation time must be within operating hours (${open_time} - ${close_time}).`);
      }
      if ((!counter?.startNow && (minutesOfDay(startTime) - minutesOfDay(open_time)) % interval !== 0) || durationMinutes % interval !== 0) {
        throw new Error(`Bookings must follow ${interval}-minute time slots.`);
      }

      // Check closures
      const [closures] = await connection.execute(
        'SELECT reason FROM court_closures WHERE (court_id = ? OR court_id IS NULL) AND closure_date = ?',
        [courtId, reservationDate]
      );
      if (closures.length > 0) {
        throw new Error(`Court is closed on ${reservationDate}: ${closures[0].reason || 'Scheduled maintenance'}`);
      }

      // 3. Check for overlapping reservations with FOR UPDATE lock
      // Overlap condition: (start_time < :end_time AND end_time > :start_time)
      const [conflictRows] = await connection.execute(
        `SELECT id, reference_number, start_time, end_time, status
         FROM reservations
         WHERE court_id = ?
           AND reservation_date = ?
           AND status IN ('pending', 'confirmed', 'completed')
           AND start_time < ?
           AND end_time > ?
         FOR UPDATE`,
        [courtId, reservationDate, endTime, startTime]
      );

      if (conflictRows.length > 0) {
        throw new Error('The selected court time slot is no longer available. Please select another time or court.');
      }

      // 4. Calculate server-side prices
      const durationHours = calculateDurationHours(startTime, endTime);
      if (durationHours <= 0) {
        throw new Error('End time must be after start time.');
      }

      const courtPrice = parseFloat((durationHours * parseFloat(court.price_per_hour)).toFixed(2));
      const servicesPrice = 0;
      const totalPrice = courtPrice;
      if (!Number.isFinite(totalPrice) || totalPrice <= 0) throw new Error('This court does not have a valid booking rate. Please contact the front desk.');

      let customer = null;
      let paymentReference = null;
      if (counter) {
        if (moneyCents(counter.amountReceived) !== moneyCents(totalPrice)) throw counterError(`The recorded payment must equal the full court total of ${totalPrice.toFixed(2)}.`, 409);
        if (paymentMethod === 'gcash') {
          paymentReference = String(counter.transactionReference || '').trim().toUpperCase();
          if (!paymentReference || paymentReference.length > 100) throw counterError('Enter a GCash reference between 1 and 100 characters.');
          const [used] = await connection.execute('SELECT id FROM payments WHERE transaction_reference = ? LIMIT 1', [paymentReference]);
          if (used.length) throw counterError('This transaction reference has already been used.', 409);
        }
        if (userId !== null && userId !== undefined) {
          const [customers] = await connection.execute("SELECT id, name, email, phone FROM users WHERE id = ? AND role = 'customer' AND is_active = 1 FOR UPDATE", [userId]);
          if (!customers.length) throw counterError('Choose an active customer account or enter a walk-in customer name.', 404);
          customer = customers[0];
        } else {
          if (typeof counter.customerName !== 'string' || !counter.customerName.trim() || counter.customerName.trim().length > 100) throw counterError('Enter a walk-in customer name between 1 and 100 characters.');
          userId = null;
          customer = { name: counter.customerName.trim(), phone: counter.customerPhone || null, email: null };
        }
      }

      // 5. Generate a unique reference number
      let referenceNumber = generateRefNumber();
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 5) {
        const [existingRef] = await connection.execute(
          'SELECT id FROM reservations WHERE reference_number = ?',
          [referenceNumber]
        );
        if (existingRef.length === 0) {
          isUnique = true;
        } else {
          referenceNumber = generateRefNumber();
          attempts++;
        }
      }
      if (!isUnique) throw new Error('Unable to allocate a booking reference. Please try again.');

      // Check auto-approval setting
      const initialStatus = counter ? counter.startNow ? 'completed' : 'confirmed' : requireApproval ? 'pending' : 'confirmed';

      // 6. Insert reservation
      const [insertRes] = await connection.execute(counter ?
        `INSERT INTO reservations (
          reference_number, user_id, court_id, reservation_date,
          start_time, end_time, duration_hours, court_price,
          services_price, total_price, status, notes,
          walk_in_name, walk_in_phone, booked_by, booking_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'front_desk')` :
        `INSERT INTO reservations (
          reference_number, user_id, court_id, reservation_date,
          start_time, end_time, duration_hours, court_price,
          services_price, total_price, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          referenceNumber,
          userId,
          courtId,
          reservationDate,
          startTime,
          endTime,
          durationHours,
          courtPrice,
          servicesPrice,
          totalPrice,
          initialStatus,
          notes,
          ...(counter ? [userId === null ? customer.name : null, userId === null ? customer.phone : null, counter.operator.id] : [])
        ]
      );

      const reservationId = insertRes.insertId;

      if (counter) {
        const paidAt = new Date();
        const paymentNotes = `Payment received and verified at the front desk by ${counter.operator.name}.${counter.startNow ? ' Customer checked in for immediate play.' : ''}`;
        const [insertPayment] = await connection.execute(
          "INSERT INTO payments (reservation_id, amount, payment_method, payment_status, transaction_reference, payment_date, notes) VALUES (?, ?, ?, 'verified', ?, ?, ?)",
          [reservationId, totalPrice, paymentMethod, paymentReference, paidAt, paymentNotes]
        );
        const payment = { id: insertPayment.insertId, reservation_id: reservationId, amount: totalPrice, payment_method: paymentMethod, payment_status: 'verified', transaction_reference: paymentReference, payment_date: paidAt.toISOString(), notes: paymentNotes, verification_action: 'verified', verified_by_name: counter.operator.name };
        await connection.execute("INSERT INTO payment_verifications (payment_id, verified_by, action, notes) VALUES (?, ?, 'verified', ?)", [payment.id, counter.operator.id, paymentNotes]);
        await connection.execute(
          'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
          [counter.operator.id, 'counter_booking_paid', 'reservation', reservationId, JSON.stringify({ reference_number: referenceNumber, payment_id: payment.id, payment_method: paymentMethod, amount: totalPrice, checked_in: Boolean(counter.startNow), customer_id: userId }), counter.ipAddress || null]
        );
        const saved = { id: reservationId, reference_number: referenceNumber, user_id: userId, court_id: courtId, court_name: court.name, reservation_date: reservationDate, start_time: startTime, end_time: endTime, duration_hours: durationHours, court_price: courtPrice, services_price: 0, total_price: totalPrice, status: initialStatus, notes, user_name: customer.name, user_email: customer.email, user_phone: customer.phone, walk_in_name: userId === null ? customer.name : null, walk_in_phone: userId === null ? customer.phone : null, booked_by: counter.operator.id, booking_source: 'front_desk', services: [], payments: [payment] };
        await connection.commit();
        return saved;
      }

      // Save the initial unpaid record in the same transaction as the booking.
      await connection.execute(
        "INSERT INTO payments (reservation_id, amount, payment_method, payment_status) VALUES (?, ?, ?, 'pending')",
        [reservationId, totalPrice, paymentMethod]
      );

      // 8. Commit transaction
      await connection.commit();

      return this.findById(reservationId);
    } catch (error) {
      await connection.rollback();
      if (counter && error.code === 'ER_DUP_ENTRY') throw counterError('This transaction reference or court booking is already recorded. Check the schedule before trying again.', 409);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Cancel a reservation
   */
  static async cancelReservation(id, userId, reason = null, isAdminOrStaff = false) {
    const reservation = await this.findById(id);
    if (!reservation) {
      throw new Error('Reservation not found.');
    }

    if (!isAdminOrStaff && reservation.user_id !== userId) {
      throw new Error('You do not have permission to cancel this reservation.');
    }

    if (reservation.status === 'cancelled') {
      throw new Error('Reservation is already cancelled.');
    }

    if (reservation.status === 'completed') {
      throw new Error('Completed reservations cannot be cancelled.');
    }

    // Check cancellation deadline for customers
    if (!isAdminOrStaff) {
      const [settings] = await pool.execute(
        "SELECT setting_value FROM settings WHERE setting_key = 'cancellation_deadline_hours'"
      );
      const deadlineHours = settings.length > 0 ? parseFloat(settings[0].setting_value) : 24;

      const reservationDateTime = new Date(`${reservation.reservation_date}T${reservation.start_time}`);
      const now = new Date();
      const diffHours = (reservationDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (diffHours < deadlineHours) {
        throw new Error(
          `Cancellations must be made at least ${deadlineHours} hour(s) before the scheduled start time.`
        );
      }
    }

    await pool.execute(
      `UPDATE reservations
       SET status = 'cancelled', cancellation_reason = ?, cancelled_at = NOW()
       WHERE id = ?`,
      [reason || 'Cancelled by user', id]
    );

    return this.findById(id);
  }

  /**
   * Update status (e.g. pending, confirmed, completed, rejected)
   */
  static async updateStatus(id, status, notes = null) {
    const updates = ['status = ?'];
    const values = [status];

    if (notes !== null) {
      updates.push('notes = ?');
      values.push(notes);
    }

    values.push(id);
    await pool.execute(
      `UPDATE reservations SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  /**
   * Query all reservations with filtering and pagination
   */
  static async findAll({
    page = 1,
    limit = 20,
    status = '',
    courtId = '',
    userId = '',
    date = '',
    startDate = '',
    endDate = '',
    search = ''
  } = {}) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }

    if (courtId) {
      conditions.push('r.court_id = ?');
      params.push(Number(courtId));
    }

    if (userId) {
      conditions.push('r.user_id = ?');
      params.push(Number(userId));
    }

    if (date) {
      conditions.push('r.reservation_date = ?');
      params.push(date);
    }

    if (startDate) {
      conditions.push('r.reservation_date >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('r.reservation_date <= ?');
      params.push(endDate);
    }

    if (search) {
      conditions.push('(r.reference_number LIKE ? OR COALESCE(u.name, r.walk_in_name) LIKE ? OR u.email LIKE ? OR c.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT r.*,
        c.name as court_name, c.court_type,
        COALESCE(u.name, r.walk_in_name) as user_name, u.email as user_email, COALESCE(u.phone, r.walk_in_phone) as user_phone
      FROM reservations r
      JOIN courts c ON r.court_id = c.id
      LEFT JOIN users u ON r.user_id = u.id
      ${whereClause}
      ORDER BY r.reservation_date DESC, r.start_time DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.execute(sql, [...params, Number(limit), Number(offset)]);

    const countSql = `
      SELECT COUNT(*) as total
      FROM reservations r
      JOIN courts c ON r.court_id = c.id
      LEFT JOIN users u ON r.user_id = u.id
      ${whereClause}
    `;

    const [countRows] = await pool.execute(countSql, params);

    return {
      reservations: rows,
      total: countRows[0].total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(countRows[0].total / limit)
    };
  }

  /**
   * Get customer's reservations
   */
  static async getUserReservations(userId, { status = '', page = 1, limit = 20 } = {}) {
    return this.findAll({ userId, status, page, limit });
  }
}

module.exports = Reservation;
