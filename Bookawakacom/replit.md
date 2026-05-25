# BookaWaka — Customer Web Replit

## 🚧 Scope rule — read before touching anything

This Replit is the **Customer Web** Replit. It owns two surfaces and nothing else:

**Surface A — Public website `bookawaka.com`** (`artifacts/invercargill-taxis`)
- 🚕 Taxi ride booking (`/book`, `/taxi`)
- 🍔 Food ordering (`/book`, `/food`)
- 📦 Freight delivery (`/book`, `/freight`)
- 🚛 Tow request (`/tow`, `/tow/track`, `/towing`)
- 🚗 Rental car booking (`/book`, `/rent`)
- 🚕➡️🚗 Ride-to-rental cross-sell
- 📄 Static/marketing pages (`/`, service landing pages, contact)
- 🧾 My Rides + Wallet (`/my-rides`)

**Surface B — Passenger mobile app API** (`artifacts/api-server`, namespace `/api/passenger/*`)
- Currently: towing, rental endpoints
- Later: taxi, food, freight passenger endpoints
- Same backend, same Firebase, same Stripe as Surface A

**NOT in scope for this Replit** (live in their own Replits — do not add here):
- ❌ Operator signup (`/join` button now links externally to dispatcher login — internal `/join` page kept as backward-safe fallback only, do not extend)
- ❌ Admin / owner portals (SA Portal Replit)
- ❌ Dispatcher HQ / driver-facing screens (SA Portal / Driver App)
- ❌ Stripe webhook handler **lives here** (it's part of the customer payment flow) — but admin Stripe dashboards do not

**Single shared infra across all Replits:**
- One Firebase RTDB (`taxilatest.firebaseio.com`) — this IS the cross-Replit integration layer. No cross-Replit HTTP calls between Customer Web ↔ SA Portal; both write to Firebase directly.
- One Firebase Auth tenant (`taxilatest`) — driver app, passenger app, owner portals all live here. Roles via custom claims: `role: 'passenger'` (or absent = passenger default), `role: 'driver'`. SA Portal sets claims via Firebase Admin SDK at account creation.
- One Stripe account
- Path map below is the contract — do not change paths without SA sign-off

## Cross-Replit integration patterns (SA dev signed off)

- **No CORS allow-lists or shared auth between Customer Web ↔ SA Portal.** Firebase RTDB is the integration layer.
- **Customer Web → external services** (server-to-server, no CORS):
  - `POST {dispatch}/api/job/create` — Job ID generation (already in `lib/jobId.ts`)
  - SA SQL dispatch API for food orders (see "SA SQL Dispatch API" section)
- **SA Portal → Customer Web** (when needed, e.g. wallet reconciliation):
  - Header pattern: `X-Admin-Key: $BW_ADMIN_KEY` — server-to-server, no CORS
  - Planned read-only endpoints (not yet built): `GET /api/admin/wallet/balance/:uid`, `GET /api/admin/wallet/ledger/:uid`, `GET /api/admin/wallet/reconciliation?from=&to=`
  - Planned write endpoint: `POST /api/admin/wallet/adjust` — SA staff manual adjustments; physically written by Customer Web (single-writer principle)

## Mobile app auth phasing

- **Phase A (today, pre-mobile-app launch):** keep existing field-level auth — phone last-4 for tow cancel, cancelToken/email for rental cancel.
- **Phase B (when mobile app ships):** add `requireAppAuth` middleware on `/api/passenger/*` **write endpoints only** (`/book`, `/cancel`, `/payment-intent`). Verifies `Authorization: Bearer <Firebase ID token>` against `taxilatest` tenant. Read endpoints (`/search`, `/track`, `/booking/:id`) stay public-but-rate-limited so the website doesn't need an auth dance.
- The dual mount (`/api/*` + `/api/passenger/*` → same router) is intentional. Future refactor: split into `publicRouter` (website) + `passengerRouter` (mobile, gets `requireAppAuth`) sharing service functions. Not blocking — current setup is backward-safe.

## Canonical booking status enum (SA dev confirmed)

| Status | Emitted by | Notes |
|---|---|---|
| `Scheduled` | Passenger app, web | Future booking |
| `Pending` | Dispatch | Waiting for driver |
| `PendingPayment` | Passenger app, web | Card bookings awaiting Stripe confirm |
| `Offered` | Dispatch | Job presented to a driver; awaiting accept/decline. **Passenger sees "Finding a driver"** and can still cancel (no driver committed yet). Aliases observed in the wild: `Offer`, `Offering` |
| `Assigned` / `Accepted` | Dispatch + driver app | Aliases — treat same |
| `EnRoute` | Driver app | Heading to pickup |
| `OnTrip` / `Started` | Driver app | Passenger in vehicle — aliases |
| `Arrived` | Driver app | At pickup |
| `Declined` | Driver app | Driver declined offer → dispatch reassigns. **Passenger sees "Finding another driver"** |
| `Reassigned` | Dispatch | Job moved to another driver |
| `NoShow` | Driver app | Passenger didn't appear |
| `Completed` | Driver app | Trip finished |
| `Cancelled` / `cancelled` | Dispatch, driver app, passenger app, SA Portal | ⚠️ **Both casings exist** — filter on both |
| `Closed` | (future, not yet emitted) | Reserved |

**Field name caveat:** records may carry **both** `status` (lowercase) AND `Status` (uppercase) simultaneously. When reading, prefer `Status || status`. When writing updates, write both for max compatibility.

Frontend `statusLabel()` in `MyRidesPage.tsx` matches case-insensitively. Backend filters in `myrides.ts` should do the same.

## Overview

BookaWaka is a booking PLATFORM (not a taxi company itself) — companies/operators run their own taxi businesses on the platform. Built as a React + Vite single-page application with Tailwind CSS, backed by an Express API server connected to Firebase RTDB.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS v4
- **Fonts**: Plus Jakarta Sans, Playfair Display
- **Animations**: Framer Motion (scroll-triggered)
- **UI Components**: shadcn/ui + Radix UI
- **Routing**: wouter
- **Backend**: Express (API server)
- **Database**: Firebase Realtime Database (`https://taxilatest.firebaseio.com`)
- **Email**: Resend integration (onboarding@resend.dev → info@bookawaka.com)
- **Payments**: Stripe SDK installed; requires `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` env vars

## Artifacts

- **invercargill-taxis** (`artifacts/invercargill-taxis/`) — Marketing site + booking page at `/`
- **api-server** (`artifacts/api-server/`) — Express API at `/api`

## Firebase RTDB — Confirmed Path Map (SA portal verified)

All paths below have been confirmed with the SA team. Do not change paths without SA sign-off.

### Bookings

**Cash bookings — ASAP** — written immediately on confirmation:
- `pendingjobs/{companyId}/{bookingId}` — dispatch queue; dispatcher monitors this
- `allbookings/{companyId}/{bookingId}` — full history; SA portal reads this
- `Passengerjobs/{passengerKey}/{bookingId}` — passenger ride history

**Cash bookings — Scheduled (Later)** — NOT written to pendingjobs at booking time:
- `allbookings/{companyId}/{bookingId}` with `Status: "Scheduled"` — SA portal scheduled/prebook view reads this
- `Passengerjobs/{passengerKey}/{bookingId}` — passenger ride history
- `pendingjobs` is written only when it is time to dispatch (handled by the SA system or a future trigger)
- Booking payload includes `Prebook: true`, `IsPreBook: true`, `BookingType: "Prebook"` so the SA app categorises them correctly

**Card (Stripe) bookings** — two-phase write:
1. On booking submit: write to `allbookings` only with `Status: "PendingPayment"`, `paymentStatus: "pending"`. Do NOT write to `pendingjobs`.
2. On Stripe webhook `checkout.session.completed`: update `allbookings` to `Status: "Pending"`, `paymentStatus: "paid"`, then write to `pendingjobs` to trigger dispatch.

### Cancellations (web/passenger-initiated)
Written to both `allbookings/{cid}/{jobId}` and `Passengerjobs/{key}/{jobId}`:
- `Status: "Cancelled"`, `status: "Cancelled"`, `CancelledAt: <ISO UTC>`, `CancelledBy: "passenger"`
- `pendingjobs/{cid}/{jobId}` Status update written so SA dispatch surfaces the cancellation in real-time

**Card-paid cancellation policy (no Stripe refund):**
- If `paymentMethod === "card"` and `paymentStatus === "paid"` and no driver assigned (`DriverId` empty/missing):
  - Fare amount is credited to `passengerWallet/{passengerKey}` (NOT refunded to card)
  - Booking gets `refundStatus: "wallet_credited"`, `walletCreditAmount: <number>`
- If a driver is already assigned: no wallet credit, `refundStatus: "not_credited_driver_assigned"`
- Passenger sees a notice on `/book` when selecting card payment so they know upfront

### Cross-surface cancel/no-show policy (SA dev confirmed 2026-05-20)

**Critical: the 70%-distance threshold is NOT enforced anywhere server-side.** It lives only in the passenger mobile app's client-side `computeCancelPolicy` function (`artifacts/passenger-app/context/RideContext.tsx`).

**Mobile app flow:**
1. On Cancel tap, app reads live `driverDistancePct` (GPS vs original pickup distance) + `paymentMethod` on the booking.
2. `computeCancelPolicy` returns one of: `refund` (wallet credit), `charge`, or `free`.
3. Outcome is stored locally in a ref; the RTDB listener uses it when the backend writes `Status: "Cancelled"`.
4. App credits the wallet client-side OR shows a charge notification — based on the stored outcome.

**Server (this Replit) does NOT enforce the rule.** `/api/my-rides/:jobId/cancel` only:
- Validates cancel is allowed for the current `Status`
- Writes the cancel fields to RTDB
- (Web only) credits the wallet if `paymentMethod === "card"` + `paymentStatus === "paid"` + no driver assigned (the "no driver yet → wallet credit" rule)

**What this means for web parity:**
- Web has no live ride screen and no GPS, so `driverDistancePct` is not available. Web cannot replicate mobile's exact `computeCancelPolicy`.
- Today's web behavior (wallet credit only when no driver assigned) is a coarser approximation of mobile's `<70% → wallet credit` — accept this gap unless a server enforcement endpoint is built.
- True enforcement (e.g. Stripe capture only when driver >70%, account invoicing on charge outcome) requires a new server-side cancel endpoint that accepts `driverDistancePct` and `cancelOutcome` from whichever client (mobile or web) and performs the charge/refund. **Not yet built.** Would benefit both surfaces; would be a coordinated change across Customer Web + Passenger App + SA Portal.

**No-show:** Backend never emits `NoShow` from passenger-initiated paths. Status arrives via dispatch/driver app writing to `allbookings`. Web's My Rides reads it through the overlay and renders "No show" — but does not show payment-aware messaging (cash vs card vs TM). Mobile does.

**Payment types matrix (mobile policy — for reference; only Cash + Card apply to web today):**

| Payment | Driver < 70% | Driver ≥ 70% | No driver yet |
|---|---|---|---|
| Cash | free | free | free |
| Card / wallet / gift card | wallet credit | charge via Stripe | wallet credit |
| Account / ACC / business | charge (invoice) | charge (invoice) | free |
| TM — cash portion | free, no council charge | free, no council charge | free |
| TM — card portion | passenger % → wallet | passenger % → Stripe charge | passenger % → wallet |
| TM — account portion | passenger % → account | passenger % → account | free |

### Passenger wallet
- `passengerWallet/{passengerKey}/balance` — number, NZD dollars (display value)
- `passengerWallet/{passengerKey}/balanceCents` — number, source-of-truth (atomic transaction target)
- `passengerWallet/{passengerKey}/currency` — "NZD"
- `passengerWallet/{passengerKey}/updatedAt` — ISO UTC
- `passengerWallet/{passengerKey}/entries/{entryId}` — `{ amount, amountCents, type: "credit"|"debit", reason: "cancellation"|"spend"|"withdrawal", jobId, companyId, createdAt }`
- `GET /api/wallet?key=...` (or `email=`/`phone=`) — returns `{ balance, currency, entries, passengerKey }`
- **Slice 2 (not yet built)**: spend wallet at booking time on `/book` (Stripe partial-coverage logic), withdraw-to-card flow, SA reconciliation reporting

### Payment config (cash gating)
- `GET /api/payment-config?cid={companyId}` — reads both switches and returns `effectiveCash`
- Platform switch: `bwConfig/paymentMethods/cashEnabled`
- Company switch: `companySettings/{cid}/paymentMethods/cashEnabled`
- Both must be true for cash to be offered. Default is true if node absent.

### Booking payload key fields
- `BookingId`, `PassengerName`, `PassengerPhone`, `PickAddress`, `DropAddress` — flat strings
- `pickupLocation: {address, lat, lng}`, `dropoffLocation: {address, lat, lng}` — also written (lat/lng = 0, no geocoding)
- `Fare` — string e.g. "24.50", or "" if no fare entered
- `paymentMethod: "cash"|"card"`, `paymentStatus: "cash"|"pending"|"paid"`
- `CompanyId`, `CompanyName`, `CreatedBy: "WEB"`, `WebBooking: true`

### Passenger lookup index
- `passengerIndex/phone/{normalizedPhone}` → `{ key: passengerKey }` — phone lookup
- `passengerIndex/email/{normalizedEmail}` → `{ key: passengerKey }` — email lookup
  - Phone normalisation: strip all non-digits
  - Email normalisation: lowercase, `.` → `,`, `@` → `__at__`

### Operator registrations (BOTH writes are intentional)
- `onboardRequests/{refId}` → SA-Onboard.aspx
- `registrations/{refId}` → SA-Registrations.aspx

### Other paths
- `towRequests/{refId}` — written by `POST /api/tow`
- `contactInquiries/{inquiryId}` — contact form submissions; SA portal reader is a future build
- `companyProfiles/{companyId}` — company display info loaded by `GET /api/companies`
- `bwConfig/appSettings` — platform-level config (version gates etc.)
- `tariffs/{companyId}`, `vehicles/{companyId}` — read-only from website
- `fdRestaurants/{companyId}/{restaurantId}` — deferred; food page is static until scoped

### Food ordering paths (when built — SA dev confirmed)
- `foodOrders/{companyId}/{orderId}` — order records (per-company, NOT a flat top-level node)
- `foodMenu/{restaurantId}/items/{itemId}` — menu items with variants/modifiers schema
- Food-delivery-complete endpoint pattern documented at §114 in SA Portal replit.md

## Wallet ownership & admin API (SA dev signed off — Option 1)

**Customer Web owns the wallet end-to-end.** SA Portal renders the admin UI but never writes — it calls the admin endpoints below with `X-Admin-Key`.

### Storage (canonical, do not change)
- `passengerWallet/{passengerKey}/balance` — NZD dollars (display)
- `passengerWallet/{passengerKey}/balanceCents` — source of truth (atomic txn target)
- `passengerWallet/{passengerKey}/currency` — `"NZD"`
- `passengerWallet/{passengerKey}/updatedAt` — ISO UTC
- `passengerWallet/{passengerKey}/entries/{entryId}` — ledger entries
- `walletAdminAudit/{txId}` — immutable admin-adjustment audit (write-only, SA Portal reads)

### Bidirectional resolver (`passengerIndex`)
- `passengerIndex/phone/{normalizedPhone}` → `{ key }` (existing)
- `passengerIndex/email/{normalizedEmail}` → `{ key }` (existing)
- `passengerIndex/key/{key}` → `{ key, createdAt, uid? }` — written by bookings.ts on every web booking; `uid` is patched in at first mobile Firebase Auth (Phase B)
- `passengerIndex/uid/{uid}` → `{ key, createdAt }` — written at first mobile Firebase Auth sign-in (Phase B; not yet implemented)

Web-only user → only `passengerIndex/key/{key}` exists (no UID). When that user later installs the mobile app, the sign-in handler looks them up by email/phone, writes `passengerIndex/uid/{uid} = { key: existingKey }` and patches `passengerIndex/key/{existingKey}.uid = uid`. Wallet history preserved. No data movement, no migration.

### Admin endpoints (X-Admin-Key required)
All under `/api/admin/wallet/*`, mounted on Customer Web only. Accept any identifier (uid/key/email/phone) and resolve internally.

- `GET /api/admin/wallet/lookup?uid=…` (or `?key=` / `?email=` / `?phone=`) — returns `{ uid?, key, balance, balanceCents, currency, updatedAt }`
- `GET /api/admin/wallet/balance/:identifier?type=uid|key|email|phone` — balance only
- `GET /api/admin/wallet/ledger/:identifier?type=…&from=ISO&to=ISO` — oldest-first entries
- `GET /api/admin/wallet/reconciliation?from=ISO&to=ISO` — aggregate report: `passengerCount`, `totalBalance`, `totalCredits`, `totalDebits`, `byReason`
- `POST /api/admin/wallet/adjust` — body `{ identifier, identifierType, amount, reason, adjustedBy, note? }`. `amount` in NZD dollars (negative = debit/clawback). `reason ∈ { refund_correction, goodwill_credit, dispute_resolution, fraud_clawback, other }`. `adjustedBy` is the SA admin's display name. Writes ledger entry with `reason: 'admin_adjustment'` + `adjustReason`/`adjustedBy`, and an audit row to `walletAdminAudit/{txId}` with before/after balances.

### Secret
- `BW_ADMIN_KEY` — shared with SA Portal + External Registration. Same value across all three Replits. Rotated 2026-05-14. Never logged, never sent to the browser. SA Portal proxies via `/api/sa-wallet/*` so the key never leaves the server.

## SA SQL Dispatch API (food orders)

Food orders require an additional call to the SA SQL API so they appear in the dispatcher food panel (which reads SQL, not Firebase pendingjobs).

- **Endpoint**: `POST https://taxitime.co.nz/DataManager/Data.aspx`
- **No auth required** — open contract
- **Content-Type**: `application/json; charset=utf-8`
- **Called from**: `artifacts/api-server/src/routes/bookings.ts` → `notifyFoodDispatch()` — fire-and-forget after Firebase writes succeed
- **Payload**:
```json
{
  "action": "InsertBookingv4",
  "params": {
    "serviceType": "food",
    "BookingSource": "Website",
    "ExternalJobId": "<jobId from /api/job/create>",
    "pickupAddress": "<restaurant address>",
    "dropoffAddress": "<customer delivery address>",
    "companyId": "<companyId>"
  }
}
```
- **Note**: The SA refers to this internally as `DataSelectorRide` (their code-behind method name) but the URL does NOT include that suffix — posting to `Data.aspx` directly is correct. Confirmed working via HTTP 200 in test.

## Timezone Rules (SA confirmed)

- **Store**: always `new Date().toISOString()` (UTC)
- **Display**: always `toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })`
- Never display raw UTC or ISO strings to users

## Registration Payload Format

```json
{
  "ref": "<refId>",
  "submittedAt": "<ISO UTC>",
  "status": "pending",
  "source": "website",
  "businessName": "...",
  "contactName": "...",
  "email": "...",
  "phone": "...",
  "city": "...",
  "country": "NZ",
  "serviceType": "taxi|food|courier|rental|towing",
  "businessTypes": ["..."],
  "message": "..."
}
```

## Company IDs

Company IDs are managed via Firebase `companyProfiles/{companyId}`. Do not hardcode.

- `374161` → "Invercargill Taxi TD" (taxi)
- ID `1216` no longer exists — must not be used anywhere.

## Admin Access

- SA admin check: `superAdmins/{uid} = true`
- Do NOT use `adminAccess/{companyId}/{uid}` — that pattern is removed

## Secrets / Env Vars

- `FIREBASE_PRIVATE_KEY` — full service account JSON string
- `SESSION_SECRET` — session secret
- `STRIPE_SECRET_KEY` — required for card payments (set ✅)
- `STRIPE_WEBHOOK_SECRET` — required for Stripe webhook to trigger dispatch
- Resend credentials managed by Resend integration

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/invercargill-taxis run dev` — run website locally
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Future Features (tracked, not yet built)

- SA portal contact inquiries inbox — reads `contactInquiries/`, filters by status, mark-as-read/resolved
- Dynamic food listing on website — pulls from `fdRestaurants/{companyId}` when scoped
