const { pool, getConnection } = require('../config/db');
const { reminderDates, reminderMinutes } = require('../utils/reminderTime');
const { buildGameReminderMessage } = require('../utils/gameReminderMessage');

const RESERVATION_SQL = `SELECT r.id, r.reference_number, r.user_id, r.reservation_date,
  r.start_time, r.status, c.name AS court_name, u.name AS user_name, u.email AS user_email
  FROM reservations r
  JOIN courts c ON c.id = r.court_id
  JOIN users u ON u.id = r.user_id AND u.is_active = 1`;

const CANDIDATES_SQL = `SELECT r.id FROM reservations r
  JOIN users u ON u.id = r.user_id AND u.is_active = 1
  LEFT JOIN reservation_reminders gr ON gr.reservation_id = r.id
    AND gr.reservation_date = r.reservation_date AND gr.start_time = r.start_time
  WHERE r.status = 'confirmed' AND r.reservation_date BETWEEN ? AND ?
    AND (gr.reservation_id IS NULL OR gr.notified_at IS NULL OR gr.email_status = 'pending')
  ORDER BY r.reservation_date, r.start_time, r.id`;

const keyFor = (reservation) => [reservation.id, reservation.reservation_date, reservation.start_time];

class GameReminder {
  static async findCandidates(now, timeZone) {
    const [rows] = await pool.execute(CANDIDATES_SQL, reminderDates(now, timeZone));
    return rows;
  }

  static async claim(id, now, timeZone) {
    const connection = await getConnection();
    try {
      await connection.beginTransaction();
      // Every worker locks the booking before its journal, in the same order.
      const [bookings] = await connection.execute(`${RESERVATION_SQL} WHERE r.id = ? FOR UPDATE`, [id]);
      const reservation = bookings[0];
      const minutes = reservation?.status === 'confirmed' ? reminderMinutes(reservation, now, timeZone) : null;
      if (minutes === null) {
        await connection.commit();
        return null;
      }
      const key = keyFor(reservation);
      await connection.execute(`INSERT INTO reservation_reminders (reservation_id, reservation_date, start_time)
        VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE reservation_id = VALUES(reservation_id)`, key);
      const [records] = await connection.execute(`SELECT notified_at, email_status FROM reservation_reminders
        WHERE reservation_id = ? AND reservation_date = ? AND start_time = ? FOR UPDATE`, key);
      const record = records[0];
      if (!record) throw new Error('Reminder delivery record is missing.');
      const notificationCreated = !record.notified_at;
      if (notificationCreated) {
        const { title, message, link } = buildGameReminderMessage(reservation, { minutesUntilStart: minutes, timeZone });
        await connection.execute(`INSERT INTO notifications (user_id, title, message, type, is_read, link)
          VALUES (?, ?, ?, 'info', 0, ?)`, [reservation.user_id, title, message, link]);
        await connection.execute(`UPDATE reservation_reminders SET notified_at = UTC_TIMESTAMP()
          WHERE reservation_id = ? AND reservation_date = ? AND start_time = ?`, key);
      }
      const shouldEmail = record.email_status === 'pending';
      if (shouldEmail) {
        // Commit the attempt BEFORE SMTP. A crash or uncertain acknowledgement
        // must not cause the same email to be submitted again after a restart.
        await connection.execute(`UPDATE reservation_reminders
          SET email_status = 'sending', email_attempted_at = UTC_TIMESTAMP()
          WHERE reservation_id = ? AND reservation_date = ? AND start_time = ?`, key);
      }
      await connection.commit();
      return { reservation, key, shouldEmail, notificationCreated };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async currentReservation(claim, now, timeZone) {
    const [rows] = await pool.execute(`${RESERVATION_SQL}
      WHERE r.id = ? AND r.reservation_date = ? AND r.start_time = ?`, claim.key);
    const reservation = rows[0];
    if (!reservation || reservation.status !== 'confirmed') return null;
    const minutesUntilStart = reminderMinutes(reservation, now, timeZone);
    return minutesUntilStart === null ? null : { reservation, minutesUntilStart, timeZone };
  }

  static async finishEmail(key, status, errorCode = null) {
    if (!['sent', 'simulated', 'failed', 'unconfirmed'].includes(status)) throw new Error('Invalid reminder email status.');
    await pool.execute(`UPDATE reservation_reminders SET email_status = ?, last_error_code = ?,
      email_sent_at = CASE WHEN ? = 'sent' THEN UTC_TIMESTAMP() ELSE NULL END
      WHERE reservation_id = ? AND reservation_date = ? AND start_time = ? AND email_status = 'sending'`,
    [status, errorCode, status, ...key]);
  }
}

module.exports = { GameReminder, CANDIDATES_SQL };
