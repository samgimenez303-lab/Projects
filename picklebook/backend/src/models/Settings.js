const { pool } = require('../config/db');

class Settings {
  /**
   * Get all settings as a key-value object and array
   */
  static async getAll() {
    const [rows] = await pool.execute('SELECT setting_key, setting_value, description, updated_at FROM settings');
    const settingsMap = {};
    for (const row of rows) {
      settingsMap[row.setting_key] = row.setting_value;
    }
    return {
      map: settingsMap,
      list: rows
    };
  }

  /**
   * Get a single setting by key
   */
  static async get(key, defaultValue = null) {
    const [rows] = await pool.execute('SELECT setting_value FROM settings WHERE setting_key = ?', [key]);
    if (rows.length === 0) return defaultValue;
    return rows[0].setting_value;
  }

  /**
   * Set or update a single setting
   */
  static async set(key, value, updatedBy = null) {
    const [result] = await pool.execute(
      `INSERT INTO settings (setting_key, setting_value, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [key, String(value), updatedBy]
    );
    return result;
  }

  /**
   * Update multiple settings in batch
   */
  static async setMany(settingsObj, updatedBy = null) {
    for (const [key, value] of Object.entries(settingsObj)) {
      await this.set(key, value, updatedBy);
    }
    return this.getAll();
  }
}

module.exports = Settings;
