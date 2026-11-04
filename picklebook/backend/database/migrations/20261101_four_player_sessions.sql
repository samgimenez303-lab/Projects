-- Add optional players 3 and 4 to existing shared-timer sessions.
-- The db:migrate:players runner checks each column and applies missing statements
-- independently, so it can recover after a partially completed upgrade.
-- Manual use: run each ALTER only when its target column is absent.
ALTER TABLE walk_in_players
  ADD COLUMN third_name VARCHAR(100) DEFAULT NULL AFTER second_name;
ALTER TABLE walk_in_players
  ADD COLUMN fourth_name VARCHAR(100) DEFAULT NULL AFTER third_name;
