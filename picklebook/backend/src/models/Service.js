const { pool } = require('../config/db');

class Service {
  /**
   * Find all services with optional filters
   */
  static async findAll({ is_active = null, category = null } = {}) {
    let sql = "SELECT * FROM services WHERE legacy_category IS NULL AND category IN ('indoor', 'outdoor')";
    const params = [];

    if (is_active !== null && is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(Number(is_active));
    }

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY sort_order ASC, name ASC';

    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  /**
   * Find service by primary key
   */
  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM services WHERE id = ?', [id]);
    return rows[0] || null;
  }

  /**
   * Find multiple services by an array of IDs
   */
  static async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT * FROM services WHERE id IN (${placeholders})`,
      ids
    );
    return rows;
  }

  /**
   * Create a court service listing. Prices are always taken from the selected court.
   */
  static async create(data) {
    const {
      name,
      description = null,
      category = 'outdoor',
      image_url = null,
      is_active = 1,
      sort_order = 0
    } = data;

    const [result] = await pool.execute(
      `INSERT INTO services (name, description, category, price, duration_minutes, image_url, is_active, max_quantity, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, category, 0, null, image_url, is_active ? 1 : 0, null, sort_order]
    );

    return this.findById(result.insertId);
  }

  /**
   * Update service fields
   */
  static async update(id, fields) {
    const allowed = [
      'name', 'description', 'category', 'image_url', 'is_active', 'sort_order'
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
        `UPDATE services SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    return this.findById(id);
  }

  /**
   * Archive a service while preserving historical reservation links.
   */
  static async delete(id) {
    const [result] = await pool.execute('UPDATE services SET is_active = 0 WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Service;
