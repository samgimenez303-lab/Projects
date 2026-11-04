const { pool } = require('../config/db');
const { BOOKING_SETTINGS_SQL, parseBookingPolicy, facilityNow, parseBookingDate } = require('../utils/bookingPolicy');

class Court {
  /**
   * Find all courts (optionally filtered by active state)
   */
  static async findAll({ is_active = null } = {}) {
    let sql = `
      SELECT c.*, 
        ci.image_url as primary_image_url
      FROM courts c
      LEFT JOIN court_images ci ON c.id = ci.court_id AND ci.is_primary = 1
    `;
    const params = [];

    if (is_active !== null && is_active !== undefined) {
      sql += ' WHERE c.is_active = ?';
      params.push(Number(is_active));
    }

    sql += ' ORDER BY c.sort_order ASC, c.id ASC';

    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  /**
   * Find court by ID with images and operating hours
   */
  static async findById(id) {
    const [courtRows] = await pool.execute(
      'SELECT * FROM courts WHERE id = ?',
      [id]
    );

    if (courtRows.length === 0) return null;
    const court = courtRows[0];

    // Fetch images
    const [images] = await pool.execute(
      'SELECT id, image_url, alt_text, is_primary, sort_order FROM court_images WHERE court_id = ? ORDER BY sort_order ASC, id ASC',
      [id]
    );
    court.images = images;

    // Fetch operating hours
    const [operatingHours] = await pool.execute(
      'SELECT id, day_of_week, open_time, close_time, is_closed FROM court_operating_hours WHERE court_id = ? ORDER BY day_of_week ASC',
      [id]
    );
    court.operating_hours = operatingHours;

    return court;
  }

  /**
   * Create a new court
   */
  static async create(data) {
    const {
      name,
      description = null,
      court_type = 'outdoor',
      surface_type = 'concrete',
      price_per_hour,
      max_players = 4,
      has_lighting = 1,
      has_seating = 0,
      is_active = 1,
      sort_order = 0
    } = data;

    const [result] = await pool.execute(
      `INSERT INTO courts (name, description, court_type, surface_type, price_per_hour, max_players, has_lighting, has_seating, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, court_type, surface_type, price_per_hour, max_players, has_lighting ? 1 : 0, has_seating ? 1 : 0, is_active ? 1 : 0, sort_order]
    );

    const courtId = result.insertId;

    // Set default operating hours (Mon-Sun 06:00 to 22:00)
    for (let day = 0; day <= 6; day++) {
      await pool.execute(
        `INSERT INTO court_operating_hours (court_id, day_of_week, open_time, close_time, is_closed)
         VALUES (?, ?, '06:00:00', '22:00:00', 0)`,
        [courtId, day]
      );
    }

    return this.findById(courtId);
  }

  /**
   * Update court fields
   */
  static async update(id, fields) {
    const allowed = [
      'name', 'description', 'court_type', 'surface_type', 'price_per_hour',
      'max_players', 'has_lighting', 'has_seating', 'is_active', 'sort_order'
    ];
    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }

    if (updates.length > 0) {
      values.push(id);
      await pool.execute(
        `UPDATE courts SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    return this.findById(id);
  }

  /**
   * Delete court
   */
  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM courts WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // =================== OPERATING HOURS ===================
  static async getOperatingHours(courtId) {
    const [rows] = await pool.execute(
      'SELECT id, court_id, day_of_week, open_time, close_time, is_closed FROM court_operating_hours WHERE court_id = ? ORDER BY day_of_week ASC',
      [courtId]
    );
    return rows;
  }

  static async setOperatingHours(courtId, hoursArray) {
    for (const item of hoursArray) {
      const { day_of_week, open_time, close_time, is_closed } = item;
      await pool.execute(
        `INSERT INTO court_operating_hours (court_id, day_of_week, open_time, close_time, is_closed)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE open_time = VALUES(open_time), close_time = VALUES(close_time), is_closed = VALUES(is_closed)`,
        [courtId, day_of_week, open_time, close_time, is_closed ? 1 : 0]
      );
    }
    return this.getOperatingHours(courtId);
  }

  // =================== COURT CLOSURES ===================
  static async getClosures(courtId = null, startDate = null, endDate = null) {
    let sql = `
      SELECT cc.*, u.name as created_by_name, c.name as court_name
      FROM court_closures cc
      LEFT JOIN users u ON cc.created_by = u.id
      LEFT JOIN courts c ON cc.court_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (courtId !== null) {
      sql += ' AND (cc.court_id = ? OR cc.court_id IS NULL)';
      params.push(courtId);
    }

    if (startDate) {
      sql += ' AND cc.closure_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND cc.closure_date <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY cc.closure_date ASC';

    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  static async addClosure({ court_id = null, closure_date, reason = null, created_by = null }) {
    const [result] = await pool.execute(
      'INSERT INTO court_closures (court_id, closure_date, reason, created_by) VALUES (?, ?, ?, ?)',
      [court_id, closure_date, reason, created_by]
    );
    return result.insertId;
  }

  static async deleteClosure(closureId) {
    const [result] = await pool.execute('DELETE FROM court_closures WHERE id = ?', [closureId]);
    return result.affectedRows > 0;
  }

  // =================== COURT IMAGES ===================
  static async addImage(courtId, imageUrl, altText = null, isPrimary = 0, sortOrder = 0) {
    if (isPrimary) {
      await pool.execute('UPDATE court_images SET is_primary = 0 WHERE court_id = ?', [courtId]);
    }

    const [result] = await pool.execute(
      'INSERT INTO court_images (court_id, image_url, alt_text, is_primary, sort_order) VALUES (?, ?, ?, ?, ?)',
      [courtId, imageUrl, altText, isPrimary ? 1 : 0, sortOrder]
    );
    return result.insertId;
  }

  static async deleteImage(imageId) {
    const [result] = await pool.execute('DELETE FROM court_images WHERE id = ?', [imageId]);
    return result.affectedRows > 0;
  }

  static async setPrimaryImage(courtId, imageId) {
    await pool.execute('UPDATE court_images SET is_primary = 0 WHERE court_id = ?', [courtId]);
    await pool.execute('UPDATE court_images SET is_primary = 1 WHERE court_id = ? AND id = ?', [courtId, imageId]);
    return true;
  }

  // =================== COURT AVAILABILITY ===================
  /**
   * Check court availability for a specific date
   * @param {number} courtId 
   * @param {string} date YYYY-MM-DD
   */
  static async getAvailability(courtId, date) {
    const dateObj = parseBookingDate(date);
    const court = await this.findById(courtId);
    if (!court) return null;
    const [settingRows] = await pool.execute(BOOKING_SETTINGS_SQL);
    const { policy } = parseBookingPolicy(settingRows);
    const now = facilityNow(policy.business_timezone);
    const base = { court_id: court.id, court_name: court.name, date, price_per_hour: court.price_per_hour, ...policy };
    const unavailable = (reason) => ({ ...base, is_available: false, reason, slots: [] });
    const dayDifference = (dateObj.getTime() - Date.parse(`${now.date}T00:00:00Z`)) / 86400000;
    if (dayDifference < 0 || dayDifference > policy.booking_advance_days) return unavailable(`Choose a booking date within the next ${policy.booking_advance_days} days.`);
    if (!court.is_active) return unavailable('Court is inactive');

    // Check closures
    const [closures] = await pool.execute(
      'SELECT reason FROM court_closures WHERE (court_id = ? OR court_id IS NULL) AND closure_date = ?',
      [courtId, date]
    );

    if (closures.length > 0) {
      return unavailable(closures[0].reason || 'Court is closed for maintenance or holiday');
    }

    // Determine day of week: JavaScript getUTCDay() from date string YYYY-MM-DD
    const dayOfWeek = dateObj.getUTCDay(); // 0 = Sunday, 6 = Saturday

    const [hoursRows] = await pool.execute(
      'SELECT open_time, close_time, is_closed FROM court_operating_hours WHERE court_id = ? AND day_of_week = ?',
      [courtId, dayOfWeek]
    );

    if (hoursRows.length === 0 || hoursRows[0].is_closed) {
      return unavailable('Court is closed on this day of the week');
    }

    const { open_time, close_time } = hoursRows[0];

    // Public availability exposes occupied times without customer or booking identifiers.
    const [bookedReservations] = await pool.execute(
      `SELECT start_time, end_time
       FROM reservations
       WHERE court_id = ? AND reservation_date = ? AND status IN ('pending', 'confirmed', 'completed')
       ORDER BY start_time ASC`,
      [courtId, date]
    );

    const toMinutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
    const formatTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const startMinutes = toMinutes(open_time);
    const endMinutes = toMinutes(close_time);
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || startMinutes >= endMinutes) return unavailable('Court operating hours are unavailable. Please contact the front desk.');
    const interval = policy.booking_slot_interval;
    const slots = [];
    for (let minute = startMinutes; minute + interval <= endMinutes; minute += interval) {
      const start = formatTime(minute);
      const end = formatTime(minute + interval);
      const conflict = bookedReservations.some((reservation) => `${start}:00` < reservation.end_time && `${end}:00` > reservation.start_time);
      const passed = date === now.date && `${start}:00` <= now.time;
      slots.push({
        start_time: start,
        end_time: end,
        is_available: !conflict && !passed
      });
    }

    return {
      ...base,
      open_time,
      close_time,
      is_available: slots.some(s => s.is_available),
      booked_reservations: bookedReservations.map(({ start_time, end_time }) => ({ start_time, end_time })),
      slots
    };
  }
}

module.exports = Court;
