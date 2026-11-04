-- Durable reminder journal for each reservation's scheduled start.
-- Run against the configured PickleBook database. Safe to repeat.
-- Delivery markers use UTC and survive deletion of the in-app notification.
CREATE TABLE IF NOT EXISTS reservation_reminders (
  reservation_id INT NOT NULL,
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  notified_at DATETIME DEFAULT NULL,
  email_status ENUM('pending', 'sending', 'sent', 'simulated', 'failed', 'unconfirmed') NOT NULL DEFAULT 'pending',
  email_attempted_at DATETIME DEFAULT NULL,
  email_sent_at DATETIME DEFAULT NULL,
  last_error_code VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reservation_id, reservation_date, start_time),
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
) ENGINE=InnoDB;
