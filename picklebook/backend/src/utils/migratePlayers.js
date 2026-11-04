const fs = require('node:fs/promises');
const path = require('node:path');
const { pool } = require('../config/db');

async function migratePlayers() {
  try {
    const migrationPath = path.resolve(__dirname, '../../database/migrations/20261101_walk_in_players.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');
    await pool.query(sql);
    const [columns] = await pool.execute(
      'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      ['walk_in_players', 'second_name']
    );
    if (!columns.length) {
      const pairMigrationPath = path.resolve(__dirname, '../../database/migrations/20261101_two_player_sessions.sql');
      await pool.query(await fs.readFile(pairMigrationPath, 'utf8'));
    }
    const fourPlayerPath = path.resolve(__dirname, '../../database/migrations/20261101_four_player_sessions.sql');
    const fourPlayerSql = (await fs.readFile(fourPlayerPath, 'utf8')).replace(/^--.*$/gm, '');
    const statements = fourPlayerSql.split(';').map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      const column = /ADD COLUMN (third_name|fourth_name)\b/.exec(statement)?.[1];
      if (!column) throw new Error('Unexpected four-player migration statement.');
      const [existing] = await pool.execute(
        'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        ['walk_in_players', column]
      );
      if (!existing.length) await pool.query(statement);
    }
    console.log('Walk-in player storage is ready.');
  } catch (error) {
    console.error(`Player storage setup failed (${error.code || 'UNKNOWN_ERROR'}).`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migratePlayers();
