# PickleBook

Indoor and outdoor pickleball court reservations with player, staff, and administrator interfaces. The React/Vite frontend connects to an Express API and MySQL database.

## Run locally

1. Start MySQL. For a fresh database, import `backend/database/schema.sql`, then optionally `backend/database/seed.sql` for example courts. For an existing database, follow `backend/database/MIGRATIONS.md` instead of importing the fresh schema.
2. Configure `backend/.env` using `.env.example` as the reference. Set the database connection, a private JWT secret, frontend URL, and email settings. `BUSINESS_TIMEZONE` defaults to `Asia/Manila` for booking validation.
3. Install dependencies with `npm install` in `backend` and `frontend` if needed. On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.
4. Start the API from `backend`: `npm run dev` (port 5000).
5. Start the interface from `frontend`: `npm run dev` (port 5173). Open the local URL shown by Vite.

`npm run seed` in `backend` creates the initial admin and example courts from your environment configuration. Review `src/utils/seed.js` before running it on a database with existing records.

## Admin dashboard

Sign in through `/login` using an existing administrator account, then open `/admin`. The admin overview and management API require the administrator role; customer and staff accounts cannot view the financial overview.

- Choose a booking month to view expected booked income, verified payments allocated to those bookings, outstanding balances, and pending approval value. Expected income uses the stored total of confirmed and completed bookings scheduled in that month. Pending, cancelled, and rejected bookings are excluded; this is booked income rather than an estimate of future demand or profit.
- The overview contains only **The month in numbers**, **A little attention. A smoother day.**, and **Your management toolkit**. Payment reviews, the daily schedule, and court management stay on their dedicated pages.
- Attention cards open filtered payment, reservation, and inquiry lists. Verify a payment only after checking the merchant transfer or receiving the full cash amount; rejected references require a reason.
- Toolkit shortcuts open reservations, payments, court details and rates, services, users and roles, inquiries, reports and exports, and settings. **Open front desk** opens counter bookings and scheduled check-in.

Payment verification requires a staff member's or administrator's explicit submission on the payment management page. Installing this update does not create users, reset passwords, verify payments, or run a database migration automatically.

**Create session** is available at the top of the customer portal, including on mobile, and opens court booking. In the admin portal, it appears only on **Players & Timers**, where it opens the player-and-timer setup.

## Front desk pay and play

Open `/staff` with an administrator or staff account and use **Reserve court & record payment** at the top of the page.

- Enter a walk-in customer's name and optional phone number, or select an existing customer account. A walk-in booking does not create an account.
- Choose an active court and a session length for **Start now**, or choose a future date and available time. The server checks rates, operating hours, closures, duration limits, and overlapping bookings before saving.
- Choose cash or configured GCash, enter the full received amount, and explicitly confirm receipt. GCash also requires its transaction reference and a check of the merchant account. Opening the form does not record a payment.
- Saving records the reservation, verified payment, staff verification, and audit entry together. Immediate sessions are checked in and ready to play; scheduled sessions are confirmed. Records appear in the daily schedule, admin reservations, payment history, and reports.
- The saved response keeps a printable payment receipt available even if refreshing the schedule fails. This records money received at the counter; it does not transfer money or use an automatic payment gateway.

For an existing database, run `npm run db:migrate:counter` from `backend`, then restart the API. The repeatable upgrade preserves existing records while adding walk-in names and booking staff details. Fresh installations include these fields in `schema.sql`.

## Walk-in players and timers

Admin and staff sign-ins open their respective portals. Administrators can open **Players & Timers** at `/admin/players`. The front desk at `/staff` uses the same shared session list. The admin overview does not display players or timers.

- Add two to four player names and a session duration (1–720 minutes, initially 60). The first two names are required; add up to two more players for a maximum of four per session. All players in a session share one countdown. No reservation, court selection, email, or player account is required.
- Select a saved session to show its green match display, player panels, and large countdown. Start, pause, resume, reset, or finish the shared timer. Edit the roster or remove a session from its management controls.
- Use **Fullscreen** for a court-side display. The exit control or Escape returns to the portal. Browsers that cannot enter native fullscreen use an expanded display within the browser.
- Player names and the shared timer state are saved in MySQL. Running timers continue across page changes, refreshes, and server restarts. Open portals refresh the shared list every 15 seconds and when returning to the tab.
- Existing single-name entries are retained. Add the second player name before starting or resuming their shared timer.
- Existing bookings, payments, and scheduled check-in remain available separately.

For an existing database, run `npm run db:migrate:players` from `backend` before using the board, then restart the API. This explicit, repeatable command creates `walk_in_players` if needed and adds missing nullable name columns to older installations without discarding existing entries. Fresh installations include all four name fields in `schema.sql`.

## Booking and payment

- Guests see Home, About, and Sign In navigation. Court listings, court details, services, and booking pages require sign-in, including direct links. Get started opens sign-in for guests and returns them to Courts after a successful login; direct links preserve their requested page and query parameters.
- Services describe indoor and outdoor courts. The selected court's hourly rate determines the booking total; the service listings are not extra charges. Legacy booking line items remain readable.
- Availability and booking limits are checked on the server. A booking and its initial pending payment are saved together in one transaction.
- Cash remains pending until staff records receipt of the full amount. For GCash, configure the actual account name and mobile number in **Admin → Settings**. Placeholder details leave GCash unavailable.
- Players transfer through their GCash app and submit the transaction reference. Staff verifies the transfer against the merchant account before marking it paid. This is a manual verification flow, without an automatic payment gateway or card collection.
- Submitted references, verified payments, refunds, and cancelled bookings have explicit guards. Unique transaction references require the supplied database migration for existing installations.
- No database migration or money transfer runs automatically. Refund requests are handled by facility staff.

## Appearance and booking receipts

- Use the sun/moon button in the public navigation or account header to switch between light and dark mode. The browser's system preference is used until a choice is saved; the choice persists across pages and reloads.
- After a booking is saved, the player sees **Thank you for choosing PickleBook**, the reservation reference, email status, and a **View & print booking receipt** action. Payment options remain a separate next step.
- The saved booking payload keeps the confirmation and print action available even if the follow-up details request fails. Payment and receipt dialogs open one at a time.
- The booking email contains the thank-you message, reservation details, payment status, and a printable receipt attachment. Standard supported text produces a PDF; other scripts or unusually long content use a UTF-8 HTML receipt to preserve all customer text. Open the HTML attachment in a browser and use Print / Save as PDF.
- Pending or unverified payments produce a **booking receipt**, not proof of payment. A **payment receipt** requires verified payments covering the total. Printouts use white paper colors in both themes.

For live email, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, and `FRONTEND_URL` in `backend/.env`, then set `EMAIL_DEV_MODE=false` and restart the backend. Use the provider's SMTP/app-password requirements. Keep credentials out of source control and chat. `EMAIL_DEV_MODE=true` writes an email preview to the backend console and does not send email.

SMTP acceptance is reported as `sent`; preview mode as `simulated`; a failed send as `failed`. If the overall eight-second wait expires, the API returns `unconfirmed` because the SMTP attempt may still finish. Email errors do not undo a committed reservation or make the client submit it again. A successful SMTP acceptance does not guarantee inbox placement; customers should also check spam.

## Verification

From `backend`, run `npm test -- --runInBand`. The tests cover payment ownership and state transitions, reservation rollback, booking limits, service validation, merchant configuration, email result handling, printable attachments, post-save email failures, and admin overview authorization and accounting. Database/SMTP connections are mocked; overview accounting uses isolated in-memory fixtures.

From `frontend`, run `npm test` for booking slot, payment summary, confirmation-message, and theme preference checks, then `npm run build` for the production bundle. Pages load on demand.

A running MySQL instance and configured merchant account are required to verify a complete real booking and payment workflow. Configure your web server to serve the frontend's `index.html` for application routes and forward `/api` to the backend.
