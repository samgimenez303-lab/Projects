const fs = require('node:fs/promises');
const path = require('node:path');
const { pool } = require('../config/db');

const safeErrorCode = (error) => /^[A-Z0-9_]{1,50}$/.test(error?.code || '') ? error.code : 'UNKNOWN_ERROR';

async function migrateReminders() {
  try {
    const migrationPath = path.resolve(__dirname, '../../database/migrations/20261103_game_reminders.sql');
    await pool.query(await fs.readFile(migrationPath, 'utf8'));
    console.log('Reservation reminder storage is ready.');
  } catch (error) {
    console.error(`Reminder storage setup failed (${safeErrorCode(error)}).`);
    process.exitCode = 1;
  } finally {
    try {
      await pool.end();
    } catch (error) {
      console.error(`Reminder storage connection cleanup failed (${safeErrorCode(error)}).`);
      process.exitCode = 1;
    }
  }
}

migrateReminders();
