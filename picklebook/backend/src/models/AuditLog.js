const { pool } = require('../config/db');

class AuditLog {
  /**
   * Record an audit event
   */
  static async log({
    userId = null,
    action,
    entityType,
    entityId = null,
    details = null,
    ipAddress = null
  }) {
    try {
      const detailsJson = details ? JSON.stringify(details) : null;
      await pool.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, action, entityType, entityId, detailsJson, ipAddress]
      );
    } catch (error) {
      // Don't fail the primary transaction if audit logging fails, but log the error
      console.error('AuditLog error:', error.message);
    }
  }

  /**
   * Retrieve audit logs with filtering and pagination
   */
  static async findAll({
    page = 1,
    limit = 50,
    action = '',
    entityType = '',
    userId = '',
    startDate = '',
    endDate = ''
  } = {}) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (action) {
      conditions.push('al.action = ?');
      params.push(action);
    }

    if (entityType) {
      conditions.push('al.entity_type = ?');
      params.push(entityType);
    }

    if (userId) {
      conditions.push('al.user_id = ?');
      params.push(Number(userId));
    }

    if (startDate) {
      conditions.push('al.created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('al.created_at <= ?');
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.execute(sql, [...params, Number(limit), Number(offset)]);

    const countSql = `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`;
    const [countRows] = await pool.execute(countSql, params);

    return {
      logs: rows,
      total: countRows[0].total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(countRows[0].total / limit)
    };
  }
}

module.exports = AuditLog;
