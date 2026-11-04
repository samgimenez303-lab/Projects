const { pool } = require('../config/db');

class Notification {
  /**
   * Create a new notification for a user
   */
  static async create({ userId, title, message, type = 'info', link = null }) {
    const [result] = await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type, is_read, link)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [userId, title, message, type, link]
    );

    const [rows] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [result.insertId]);
    return rows[0];
  }

  /**
   * Find notifications for a specific user
   */
  static async findByUser(userId, { unreadOnly = false, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    let sql = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [userId];

    if (unreadOnly) {
      sql += ' AND is_read = 0';
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.execute(sql, params);

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM notifications WHERE user_id = ? ${unreadOnly ? 'AND is_read = 0' : ''}`,
      [userId]
    );

    return {
      notifications: rows,
      total: countRows[0].total,
      page: Number(page),
      limit: Number(limit)
    };
  }

  /**
   * Mark a single notification as read
   */
  static async markAsRead(id, userId) {
    const [result] = await pool.execute(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }

  /**
   * Mark all notifications for a user as read
   */
  static async markAllAsRead(userId) {
    const [result] = await pool.execute(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return result.affectedRows;
  }

  /**
   * Count unread notifications
   */
  static async getUnreadCount(userId) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return rows[0].unread_count;
  }

  /**
   * Delete a notification
   */
  static async delete(id, userId) {
    const [result] = await pool.execute(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = Notification;
