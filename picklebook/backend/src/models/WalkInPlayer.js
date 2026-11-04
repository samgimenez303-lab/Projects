const { pool } = require('../config/db');
const { serializePlayer, timerTransition } = require('../utils/playerTimer');

const COLUMNS = 'id, name, second_name, third_name, fourth_name, duration_seconds, remaining_seconds, timer_started_at, status';

const withLockedPlayer = async (id, change) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT ${COLUMNS} FROM walk_in_players WHERE id = ? AND is_active = 1 FOR UPDATE`, [id]
    );
    if (!rows.length) throw Object.assign(new Error('Player not found.'), { statusCode: 404 });
    const result = await change(connection, rows[0], Date.now());
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const findAll = async () => {
  const [rows] = await pool.execute(
    `SELECT ${COLUMNS} FROM walk_in_players WHERE is_active = 1 ORDER BY created_at DESC, id DESC`
  );
  const serverNow = Date.now();
  return { players: rows.map((row) => serializePlayer(row, serverNow)), server_now: serverNow };
};

const create = async ({ name, secondName, thirdName = null, fourthName = null, durationMinutes, createdBy }) => {
  const duration = durationMinutes * 60;
  const [result] = await pool.execute(
    'INSERT INTO walk_in_players (name, second_name, third_name, fourth_name, duration_seconds, remaining_seconds, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, secondName, thirdName, fourthName, duration, duration, createdBy]
  );
  return { id: result.insertId, name, second_name: secondName, third_name: thirdName, fourth_name: fourthName, duration_seconds: duration, remaining_seconds: duration, timer_started_at: null, status: 'waiting' };
};

const rename = (id, { name, secondName, thirdName = null, fourthName = null }) => withLockedPlayer(id, async (connection, row, now) => {
  await connection.execute('UPDATE walk_in_players SET name = ?, second_name = ?, third_name = ?, fourth_name = ? WHERE id = ? AND is_active = 1', [name, secondName, thirdName, fourthName, id]);
  return serializePlayer({ ...row, name, second_name: secondName, third_name: thirdName, fourth_name: fourthName }, now);
});

const archive = (id) => withLockedPlayer(id, async (connection) => {
  await connection.execute('UPDATE walk_in_players SET is_active = 0 WHERE id = ? AND is_active = 1', [id]);
});

const updateTimer = (id, action, durationMinutes) => withLockedPlayer(id, async (connection, row, now) => {
  const player = timerTransition(row, action, durationMinutes, now);
  await connection.execute(
    'UPDATE walk_in_players SET duration_seconds = ?, remaining_seconds = ?, timer_started_at = ?, status = ? WHERE id = ? AND is_active = 1',
    [player.duration_seconds, player.remaining_seconds, player.timer_started_at, player.status, id]
  );
  return player;
});

module.exports = { findAll, create, rename, archive, updateTimer };
