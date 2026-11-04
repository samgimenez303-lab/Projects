-- Permit recorded front desk reservations without creating a customer account.
-- For existing installations, prefer npm run db:migrate:counter from backend.
-- Its runner checks each column/constraint and can resume a partial upgrade.
-- Manual application: run each ADD only when that column/constraint is absent.
ALTER TABLE reservations MODIFY COLUMN user_id INT NULL;
ALTER TABLE reservations ADD COLUMN walk_in_name VARCHAR(100) DEFAULT NULL;
ALTER TABLE reservations ADD COLUMN walk_in_phone VARCHAR(20) DEFAULT NULL;
ALTER TABLE reservations ADD COLUMN booked_by INT DEFAULT NULL;
ALTER TABLE reservations ADD COLUMN booking_source ENUM('online', 'front_desk') NOT NULL DEFAULT 'online';
ALTER TABLE reservations ADD CONSTRAINT fk_reservations_booked_by FOREIGN KEY (booked_by) REFERENCES users(id) ON DELETE SET NULL;
