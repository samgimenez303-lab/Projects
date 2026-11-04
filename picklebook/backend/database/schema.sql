-- PickleBook Database Schema
-- Pickleball Court Reservation and Management System

CREATE DATABASE IF NOT EXISTS picklebook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE picklebook;

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('customer', 'staff', 'admin') NOT NULL DEFAULT 'customer',
  phone VARCHAR(20) DEFAULT NULL,
  avatar_url VARCHAR(500) DEFAULT NULL,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_role (role)
) ENGINE=InnoDB;

-- ============================================
-- 2. COURTS TABLE
-- ============================================
CREATE TABLE courts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  court_type ENUM('indoor', 'outdoor') NOT NULL DEFAULT 'outdoor',
  surface_type VARCHAR(50) DEFAULT 'concrete',
  price_per_hour DECIMAL(10,2) NOT NULL,
  max_players INT NOT NULL DEFAULT 4,
  has_lighting TINYINT(1) DEFAULT 1,
  has_seating TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_courts_active (is_active),
  INDEX idx_courts_type (court_type)
) ENGINE=InnoDB;

-- ============================================
-- 3. COURT IMAGES TABLE
-- ============================================
CREATE TABLE court_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  court_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  alt_text VARCHAR(255) DEFAULT NULL,
  is_primary TINYINT(1) DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE CASCADE,
  INDEX idx_court_images_court (court_id)
) ENGINE=InnoDB;

-- ============================================
-- 4. COURT OPERATING HOURS TABLE
-- ============================================
CREATE TABLE court_operating_hours (
  id INT AUTO_INCREMENT PRIMARY KEY,
  court_id INT NOT NULL,
  day_of_week TINYINT NOT NULL COMMENT '0=Sunday, 6=Saturday',
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE CASCADE,
  UNIQUE KEY uk_court_day (court_id, day_of_week),
  INDEX idx_operating_hours_court (court_id)
) ENGINE=InnoDB;

-- ============================================
-- 5. COURT CLOSURES TABLE
-- ============================================
CREATE TABLE court_closures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  court_id INT DEFAULT NULL COMMENT 'NULL means all courts',
  closure_date DATE NOT NULL,
  reason VARCHAR(255) DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_closures_date (closure_date),
  INDEX idx_closures_court (court_id)
) ENGINE=InnoDB;

-- ============================================
-- 6. SERVICES TABLE
-- ============================================
CREATE TABLE services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category ENUM('indoor', 'outdoor') NOT NULL DEFAULT 'outdoor',
  legacy_category VARCHAR(20) DEFAULT NULL COMMENT 'Archived former add-on category; retained for historical reservations only',
  price DECIMAL(10,2) NOT NULL,
  duration_minutes INT DEFAULT NULL,
  image_url VARCHAR(500) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  max_quantity INT DEFAULT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_services_active (is_active),
  INDEX idx_services_category (category)
) ENGINE=InnoDB;

-- ============================================
-- 7. RESERVATIONS TABLE
-- ============================================
CREATE TABLE reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference_number VARCHAR(20) NOT NULL UNIQUE,
  user_id INT DEFAULT NULL,
  walk_in_name VARCHAR(100) DEFAULT NULL,
  walk_in_phone VARCHAR(20) DEFAULT NULL,
  booked_by INT DEFAULT NULL,
  booking_source ENUM('online', 'front_desk') NOT NULL DEFAULT 'online',
  court_id INT NOT NULL,
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours DECIMAL(3,1) NOT NULL,
  court_price DECIMAL(10,2) NOT NULL,
  services_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_price DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'confirmed', 'cancelled', 'completed', 'rejected') NOT NULL DEFAULT 'pending',
  cancellation_reason TEXT DEFAULT NULL,
  cancelled_at DATETIME DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reservations_booked_by FOREIGN KEY (booked_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE RESTRICT,
  INDEX idx_reservations_user (user_id),
  INDEX idx_reservations_court (court_id),
  INDEX idx_reservations_date (reservation_date),
  INDEX idx_reservations_status (status),
  INDEX idx_reservations_ref (reference_number),
  INDEX idx_reservations_court_date_time (court_id, reservation_date, start_time, end_time)
) ENGINE=InnoDB;

-- ============================================
-- 8. RESERVATION SERVICES TABLE
-- ============================================
CREATE TABLE reservation_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT NOT NULL,
  service_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
  INDEX idx_res_services_reservation (reservation_id),
  INDEX idx_res_services_service (service_id)
) ENGINE=InnoDB;

-- ============================================
-- 9. PAYMENTS TABLE
-- ============================================
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash', 'gcash', 'online') NOT NULL DEFAULT 'cash',
  payment_status ENUM('pending', 'submitted', 'verified', 'rejected', 'refunded') NOT NULL DEFAULT 'pending',
  transaction_reference VARCHAR(100) DEFAULT NULL,
  payment_date DATETIME DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_payments_transaction_reference (transaction_reference),
  INDEX idx_payments_reservation (reservation_id),
  INDEX idx_payments_status (payment_status)
) ENGINE=InnoDB;

-- ============================================
-- 10. PAYMENT VERIFICATIONS TABLE
-- ============================================
CREATE TABLE payment_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id INT NOT NULL,
  verified_by INT DEFAULT NULL,
  action ENUM('verified', 'rejected') NOT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_payment_verifications_payment (payment_id)
) ENGINE=InnoDB;

-- ============================================
-- 11. EMAIL VERIFICATION TOKENS TABLE
-- ============================================
CREATE TABLE email_verification_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_email_tokens_user (user_id),
  INDEX idx_email_tokens_hash (token_hash)
) ENGINE=InnoDB;

-- ============================================
-- 12. PASSWORD RESET TOKENS TABLE
-- ============================================
CREATE TABLE password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reset_tokens_user (user_id),
  INDEX idx_reset_tokens_hash (token_hash)
) ENGINE=InnoDB;

-- ============================================
-- 13. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info', 'success', 'warning', 'error') NOT NULL DEFAULT 'info',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  link VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user (user_id),
  INDEX idx_notifications_read (user_id, is_read)
) ENGINE=InnoDB;

-- ============================================
-- 14. RESERVATION REMINDERS TABLE
-- ============================================
CREATE TABLE reservation_reminders (
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

-- ============================================
-- 15. CONTACT INQUIRIES TABLE
-- ============================================
CREATE TABLE contact_inquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('new', 'read', 'replied', 'closed') NOT NULL DEFAULT 'new',
  admin_notes TEXT DEFAULT NULL,
  replied_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (replied_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_inquiries_status (status)
) ENGINE=InnoDB;

-- ============================================
-- 16. AUDIT LOGS TABLE
-- ============================================
CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT DEFAULT NULL,
  details JSON DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;

-- ============================================
-- 17. SETTINGS TABLE
-- ============================================
CREATE TABLE settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  updated_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_settings_key (setting_key)
) ENGINE=InnoDB;

-- ============================================
-- 18. WALK-IN PLAYERS
-- ============================================
CREATE TABLE walk_in_players (
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

-- ============================================
-- DEFAULT SETTINGS
-- ============================================
INSERT INTO settings (setting_key, setting_value, description) VALUES
('booking_advance_days', '30', 'How many days in advance bookings can be made'),
('min_booking_duration', '1', 'Minimum booking duration in hours'),
('max_booking_duration', '4', 'Maximum booking duration in hours'),
('cancellation_deadline_hours', '24', 'Hours before reservation start when cancellation is allowed'),
('cancellation_refund_percentage', '100', 'Refund percentage for eligible cancellations'),
('require_admin_approval', 'false', 'Whether reservations require admin approval'),
('booking_slot_interval', '60', 'Time slot interval in minutes'),
('business_name', 'PickleBook', 'Business display name'),
('business_email', '', 'Business contact email'),
('business_phone', '', 'Business contact phone'),
('business_address', '', 'Business address'),
('gcash_number', '', 'GCash payment number; blank disables GCash'),
('gcash_name', '', 'Verified facility GCash account name');
