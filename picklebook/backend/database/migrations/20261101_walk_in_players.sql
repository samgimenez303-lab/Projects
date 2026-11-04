-- Add shared walk-in player names and persistent timers independently of bookings.
-- Run against the configured PickleBook database. Safe to repeat once installed.
CREATE TABLE IF NOT EXISTS walk_in_players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  second_name VARCHAR(100) DEFAULT NULL,
  third_name VARCHAR(100) DEFAULT NULL,
  fourth_name VARCHAR(100) DEFAULT NULL,
  duration_seconds INT UNSIGNED NOT NULL DEFAULT 3600,
  remaining_seconds DECIMAL(8,3) UNSIGNED NOT NULL DEFAULT 3600,
  timer_started_at BIGINT UNSIGNED DEFAULT NULL COMMENT 'UTC Unix epoch milliseconds',
  status ENUM('waiting', 'running', 'paused', 'finished') NOT NULL DEFAULT 'waiting',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_walk_in_players_active (is_active, created_at)
) ENGINE=InnoDB;
