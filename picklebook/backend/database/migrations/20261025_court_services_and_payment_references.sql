-- Run once against an EXISTING PickleBook database during a maintenance window.
-- Fresh installations use schema.sql instead. Read ../MIGRATIONS.md first.
USE picklebook;

-- Refuse to change financial references when normalized duplicates need review.
-- Resolve returned rows against actual payment records before retrying.
SELECT UPPER(TRIM(transaction_reference)) AS duplicate_reference, COUNT(*) AS payment_count
FROM payments
WHERE NULLIF(TRIM(transaction_reference), '') IS NOT NULL
GROUP BY UPPER(TRIM(transaction_reference))
HAVING COUNT(*) > 1;

DELIMITER //
CREATE PROCEDURE assert_unique_payment_references_20261025()
BEGIN
  IF EXISTS (
    SELECT 1 FROM payments
    WHERE NULLIF(TRIM(transaction_reference), '') IS NOT NULL
    GROUP BY UPPER(TRIM(transaction_reference))
    HAVING COUNT(*) > 1
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Duplicate payment references require review; no migration changes have been applied.';
  END IF;
END//
DELIMITER ;

CALL assert_unique_payment_references_20261025();
DROP PROCEDURE assert_unique_payment_references_20261025;

-- Retain old categories, IDs, prices and all reservation_services foreign keys.
ALTER TABLE services
  ADD COLUMN legacy_category VARCHAR(20) DEFAULT NULL
    COMMENT 'Archived former add-on category; retained for historical reservations only'
    AFTER category;

ALTER TABLE services MODIFY COLUMN category VARCHAR(20) NOT NULL DEFAULT 'outdoor';

UPDATE services
SET legacy_category = category, category = 'indoor', is_active = 0
WHERE category NOT IN ('indoor', 'outdoor');

ALTER TABLE services MODIFY COLUMN category ENUM('indoor', 'outdoor') NOT NULL DEFAULT 'outdoor';

INSERT INTO services (name, description, category, price, image_url, is_active, sort_order)
SELECT 'Indoor Pickleball',
  'Covered pickleball court reservations. Compare each court for facilities, hourly rates and availability.',
  'indoor', 0, '/court-indoor.svg', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM services WHERE category = 'indoor' AND legacy_category IS NULL);

INSERT INTO services (name, description, category, price, image_url, is_active, sort_order)
SELECT 'Outdoor Pickleball',
  'Open-air pickleball court reservations. Check lighting, operating hours and weather before your session.',
  'outdoor', 0, '/court-outdoor.svg', 1, 2
WHERE NOT EXISTS (SELECT 1 FROM services WHERE category = 'outdoor' AND legacy_category IS NULL);

-- NULL permits multiple cash payments; actual transaction references stay unique.
UPDATE payments
SET transaction_reference = NULLIF(UPPER(TRIM(transaction_reference)), '');

ALTER TABLE payments
  ADD UNIQUE KEY uk_payments_transaction_reference (transaction_reference);
