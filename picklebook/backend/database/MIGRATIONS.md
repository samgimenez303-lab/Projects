# Database setup and upgrade

## Upcoming-game reminders (2026-11-03)

From `backend`, run `npm run db:migrate:reminders` (or `npm.cmd run db:migrate:reminders` in PowerShell) before enabling reminders on an existing database. The explicit, repeatable runner applies `migrations/20261103_game_reminders.sql`, creating only the additive `reservation_reminders` delivery journal when it is absent. Existing bookings, payments, accounts, and notifications are preserved. Fresh installations include this table in `schema.sql`. The application does not apply the migration automatically, and the runner reports error codes without database credentials.

The reminder worker starts with the backend server and checks once per minute. Keep the backend running so customers receive an in-app notification and a private email about one hour before their game. Only confirmed bookings belonging to active registered accounts qualify; pending, cancelled, rejected, and completed bookings and walk-in guests do not receive these reminders. Personal bookings made by active staff or admin accounts also qualify. The schedule uses the facility's `BUSINESS_TIMEZONE` (default `Asia/Manila`), rather than the server computer's local time. After downtime, the worker catches up only while the game is still in the future and states the actual remaining minutes.

The journal is keyed by reservation, date, and start time. Its UTC `notified_at` marker remains even if the customer deletes the notification, preventing a later poll or server restart from recreating it. The worker records the notification and claims the email attempt in a transaction before sending email. Email statuses distinguish `pending`, `sending`, `sent`, `simulated`, `failed`, and `unconfirmed`. Each scheduled game receives at most one email attempt: an interrupted `sending` record, an unknown delivery outcome (`unconfirmed`), or a permanent `failed` result is not automatically retried, avoiding duplicate emails after a crash or an ambiguous SMTP acknowledgement. SMTP acceptance (`sent`) does not guarantee inbox delivery.

With `EMAIL_DEV_MODE=true`, the email is simulated in the backend logs and marked `simulated`; no live email is sent. Configure real SMTP delivery with `EMAIL_DEV_MODE=false` before relying on customer email reminders. Simulated attempts are also retained without automatic retries. A database or email failure must not prevent the saved booking or the rest of the API from working.

## Front desk pay-and-play bookings (2026-11-01)

From `backend`, run `npm run db:migrate:counter` (or `npm.cmd run db:migrate:counter` in PowerShell) before using the front desk booking form. This explicit, repeatable runner applies `migrations/20261101_counter_bookings.sql` one missing column or constraint at a time. It allows a null customer-account ID and adds walk-in name/phone, the booking staff member, and the booking source. Existing bookings, customer accounts, payments, and reservation references are preserved. A partial upgrade can be resumed with the same command. Fresh installations include these fields in `schema.sql`.

The application does not run this migration automatically. Front desk guests remain booking records without creating fabricated user accounts. Payment, receipt, schedule, and export reads include both registered customers and walk-in names. The recorded payment and verification belong to the same reservation, with the staff member retained for audit.

## Walk-in players and timers (2026-11-01)

From `backend`, run `npm run db:migrate:players` before opening player management. On PowerShell, use `npm.cmd run db:migrate:players` if needed. This explicit, repeatable runner uses the configured database connection, creates `walk_in_players` when absent, and adds missing `second_name`, `third_name`, and `fourth_name` columns when upgrading an existing table. It does not change reservations, payments, or user accounts, and does not display database credentials. Fresh installations already include all four name fields in `schema.sql`. The application does not apply migrations automatically.

The runner uses `migrations/20261101_walk_in_players.sql` for new tables and applies `migrations/20261101_two_player_sessions.sql` only when the second-name column is missing. For manual SQL upgrades, run the second migration once only against an existing table without that column. The added column is nullable to preserve existing names and timer values. Existing single-name entries remain visible; add their second player's name before starting or resuming the timer.

The runner then applies the missing-column statements from `migrations/20261101_four_player_sessions.sql` independently. This adds optional third and fourth player names while retaining existing two-player sessions and all timer values. A partial upgrade can be resumed by rerunning the command. For manual upgrades, run each `ALTER` only if its named column is absent.

Admin and front desk share this list. Each session has two to four player names sharing one timer, without customer accounts or a court reservation. The first two names are required; player 4 requires player 3. Each timer stores its remaining time and UTC start timestamp, so it continues across refreshes and server restarts. Removing a session archives the entry without deleting the record. Verify that staff and admin can add up to four names and see the same session, and that customers cannot access `/api/players`.

## Court services and payment references (2026-10-25)

Fresh database: import `schema.sql`, then optionally `seed.sql` for sample courts and the two service listings. Do not import the upgrade migration after the fresh schema.

Existing database: back up the database and pause application writes, then run `migrations/20261025_court_services_and_payment_references.sql` once with a MySQL client that stops on SQL errors. Do not use `--force`. The migration requires permission to create and drop its preflight stored procedure.

The migration first checks for duplicate transaction references after trimming and case normalization. If duplicates appear, it raises an error before changing application data or table structure. Review the affected payments against the actual transfers and correct their references; do not delete payment records. Before retrying after this preflight error, remove the leftover check procedure with `DROP PROCEDURE IF EXISTS assert_unique_payment_references_20261025;`.

The upgrade archives existing equipment, coaching, package and event services by disabling them and retaining their original category in `legacy_category`. Their IDs, original prices and links to historical reservations remain intact. It adds indoor and outdoor discovery listings. A booking is charged for its selected court; these listings add no extra charge. It also normalizes transaction references and adds a unique index to prevent the same transfer being used more than once.

MySQL schema changes commit implicitly. Keep the backup until verification is complete. If a later step fails, inspect which statements completed before proceeding; do not rerun the whole migration blindly. This migration has been provided for review and has not been run automatically.

After the upgrade, verify that there are two non-archived service categories, historical reservations still show their previous services, and the `uk_payments_transaction_reference` index exists. In the admin settings, configure the real GCash account name and number before accepting GCash submissions. Placeholder account details keep GCash unavailable. Cash is recorded and verified by staff at the front desk.
