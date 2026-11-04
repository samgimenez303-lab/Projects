const { pool } = require('../config/db');

class User {
  /**
   * Find user by primary key ID
   * @param {number} id 
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT id, name, email, role, phone, avatar_url, email_verified, is_active, last_login, created_at, updated_at
       FROM users WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find user by email (including password hash for authentication)
   * @param {string} email 
   */
  static async findByEmail(email) {
    const [rows] = await pool.execute(
      `SELECT id, name, email, password, role, phone, avatar_url, email_verified, is_active, last_login, created_at, updated_at
       FROM users WHERE email = ?`,
      [email.toLowerCase().trim()]
    );
    return rows[0] || null;
  }

  /**
   * Create a new user
   */
  static async create({ name, email, password, role = 'customer', phone = null, avatar_url = null, email_verified = 0 }) {
    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password, role, phone, avatar_url, email_verified, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [name, email.toLowerCase().trim(), password, role, phone, avatar_url, email_verified]
    );
    return this.findById(result.insertId);
  }

  /**
   * Update user profile fields
   */
  static async update(id, fields) {
    const allowed = ['name', 'phone', 'avatar_url', 'role', 'is_active', 'email_verified'];
    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }

    if (updates.length === 0) return this.findById(id);

    values.push(id);
    await pool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  /**
   * Update user password
   */
  static async updatePassword(id, hashedPassword) {
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
    return true;
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(id) {
    await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [id]);
    return true;
  }

  /**
   * Set email verification status
   */
  static async setEmailVerified(id, status = 1) {
    await pool.execute('UPDATE users SET email_verified = ? WHERE id = ?', [status, id]);
    return true;
  }

  /**
   * Query all users with pagination and filters
   */
  static async findAll({ page = 1, limit = 20, search = '', role = '', is_active = '' } = {}) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (role) {
      conditions.push('role = ?');
      params.push(role);
    }

    if (is_active !== '' && is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(Number(is_active));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute(
      `SELECT id, name, email, role, phone, avatar_url, email_verified, is_active, last_login, created_at, updated_at
       FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );

    return {
      users: rows,
      total: countRows[0].total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(countRows[0].total / limit)
    };
  }

  /**
   * Delete user (hard delete)
   */
  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // =================== EMAIL VERIFICATION TOKENS ===================
  static async createEmailVerificationToken(userId, tokenHash, expiresAt) {
    // Invalidate previous tokens
    await pool.execute('UPDATE email_verification_tokens SET used = 1 WHERE user_id = ?', [userId]);

    const [result] = await pool.execute(
      'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, used) VALUES (?, ?, ?, 0)',
      [userId, tokenHash, expiresAt]
    );
    return result.insertId;
  }

  static async findEmailVerificationToken(tokenHash) {
    const [rows] = await pool.execute(
      `SELECT evt.*, u.id as user_id, u.email, u.email_verified
       FROM email_verification_tokens evt
       JOIN users u ON evt.user_id = u.id
       WHERE evt.token_hash = ? AND evt.used = 0 AND evt.expires_at > NOW()`,
      [tokenHash]
    );
    return rows[0] || null;
  }

  static async markEmailVerificationTokenUsed(tokenId) {
    await pool.execute('UPDATE email_verification_tokens SET used = 1 WHERE id = ?', [tokenId]);
  }

  // =================== PASSWORD RESET TOKENS ===================
  static async createPasswordResetToken(userId, tokenHash, expiresAt) {
    // Invalidate previous unused tokens for this user
    await pool.execute('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?', [userId]);

    const [result] = await pool.execute(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used) VALUES (?, ?, ?, 0)',
      [userId, tokenHash, expiresAt]
    );
    return result.insertId;
  }

  static async findPasswordResetToken(tokenHash) {
    const [rows] = await pool.execute(
      `SELECT prt.*, u.id as user_id, u.email, u.name
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token_hash = ? AND prt.used = 0 AND prt.expires_at > NOW()`,
      [tokenHash]
    );
    return rows[0] || null;
  }

  static async markPasswordResetTokenUsed(tokenId) {
    await pool.execute('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [tokenId]);
  }
}

module.exports = User;
