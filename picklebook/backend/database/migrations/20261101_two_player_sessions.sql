-- Upgrade existing walk-in entries to two names sharing their saved timer.
-- The db:migrate:players runner checks for this column before applying.
-- Manual use: run once only when second_name is absent.
ALTER TABLE walk_in_players
  ADD COLUMN second_name VARCHAR(100) DEFAULT NULL AFTER name;
