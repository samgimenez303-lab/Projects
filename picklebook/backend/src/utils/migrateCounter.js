const fs = require('node:fs/promises');
const path = require('node:path');
const { pool } = require('../config/db');

async function migrateCounter() {
  try {
    const migrationPath = path.resolve(__dirname, '../../database/migrations/20261101_counter_bookings.sql');
    const sql = (await fs.readFile(migrationPath, 'utf8')).replace(/^--.*$/gm, '');
    const statements = sql.split(';').map(statement => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      const column = /ADD COLUMN (walk_in_name|walk_in_phone|booked_by|booking_source)\b/.exec(statement)?.[1];
      if (column) {
        const [columns] = await pool.execute(
          'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
          ['reservations', column]
        );
        if (!columns.length) await pool.query(statement);
      } else if (/MODIFY COLUMN user_id INT NULL$/.test(statement)) {
        const [columns] = await pool.execute(
          'SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
          ['reservations', 'user_id']
        );
        if (!columns.length) throw new Error('Reservations table is missing. Import the fresh schema first.');
        if (columns[0].IS_NULLABLE !== 'YES') await pool.query(statement);
      } else if (/ADD CONSTRAINT fk_reservations_booked_by FOREIGN KEY/.test(statement)) {
        const [constraints] = await pool.execute(
          'SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?',
          ['reservations', 'fk_reservations_booked_by']
        );
        if (!constraints.length) await pool.query(statement);
      } else {
        throw new Error('Unexpected counter migration statement.');
      }
    }
    console.log('Front desk reservation storage is ready.');
  } catch (error) {
    console.error(`Counter booking storage setup failed (${error.code || 'UNKNOWN_ERROR'}).`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrateCounter();
