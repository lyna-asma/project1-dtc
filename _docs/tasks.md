# Backlog Tasks: Blendinar — Simulated Digital Wallet and Online Merchant Payment Platform

> **Simulated-Money Notice:** All monetary flows in these tasks represent **100% fake/simulated Algerian Dinars (DZD)** stored as integer centimes (`bigint`, `dinars * 100`). Never introduce real payment rails, hardcoded admin passwords, or unverified test claims.

---

## Part 1 — Overview, Task Numbering & Status Legend

This backlog preserves all **15 historical Cohort Baseline v0 tasks (`Task 1`–`Task 15` / GitHub Issues `#6`–`#20`)** with their real verified implementation state, and defines the ordered **Blendinar v1 active backlog** organized across **9 milestones** in alignment with [`_docs/plan.md`](./plan.md), [`_docs/process.md`](./process.md), and [`_docs/task-template.md`](./task-template.md).

### Verified Repository Baseline Today
- **Codebase (`src/`):** Cohort Baseline v0 (`3` roles: `customer`, `merchant`, `admin`; phone OTP; shop-float cash top-ups; 6-char payment codes; starter placeholder card in `src/client/App.jsx`).
- **Automated Tests (`tests/`):** **10 test files, 137 passing tests** (including `tests/otp-demo-mode.test.js`), executed against real PostgreSQL via `npm test` (`vitest run --no-file-parallelism`).

### Status Legend
- **`Completed (Baseline v0)`** — Built and verified in Cohort Baseline v0; remains active and preserved.
- **`Completed (Baseline v0) — Superseded / Extended in Blendinar v1`** — Built in Cohort Baseline v0, now replaced or extended by named Blendinar v1 tasks without erasing history.
- **`Partially Completed (Baseline v0) — Remainder Tracked in Blendinar v1`** — Baseline slice implemented in v0; remaining deliverables explicitly tracked in Blendinar v1 tasks.
- **`Ready for Grooming / Active Blendinar v1`** — Clear on confirmed rules (`_docs/plan.md`); ready for PM grooming and Reviewer/Lyna gates when its dependencies complete.
- **`Blocked on Owner Decision (Open O-*)`** — Cannot enter implementation until Lyna decides the referenced `O-*` item(s) in `_docs/plan.md` Section 10.
- **`Deferred / Future (Excluded from v1)`** — Explicitly outside Blendinar v1 scope (and AI milestone explicitly **Dropped**).

---

## Part 2 — Historical Cohort Baseline Tasks (`Task 1`–`Task 15` / Issues `#6`–`#20`)

| Task / Issue | Original Goal & Scope | Verified Baseline Status | Blendinar v1 Disposition |
| :--- | :--- | :--- | :--- |
| **Task 1 (`#6`)** | Empty project setup with Express, Drizzle ORM, Vitest, PostgreSQL `docker-compose.yml`, `/health`, and React starter scaffold. | **`Completed (Baseline v0)`** | Preserved (`src/app.js`, `src/index.js`, `tests/health.test.js`). |
| **Task 2 (`#7`)** | User sign-up and simulated phone OTP (`users`, `otp_codes`, `sendOtp`, `DEMO_MODE`, zero-balance wallet creation). | **`Completed (Baseline v0)`** | **`Superseded in Blendinar v1 by Task 19`** (Email-required + simulated email OTP; phone optional). |
| **Task 3 (`#8`)** | Login, JWT issuance, 3-role RBAC (`requireAuth`, `requireRole`, `requireSelfOrAdmin`), and `seed-admin.js`. | **`Completed (Baseline v0)`** | **`Extended in Blendinar v1 by Tasks 18, 21 & 22`** (4 roles adding `agent`, live suspension check, env-only admin credentials). |
| **Task 4 (`#9`)** | Centime-based `wallets`, append-only `transactions` ledger (`CHECK (balance >= 0)`, `CHECK (amount > 0)`), and customer history. | **`Completed Foundation (Baseline v0)`** | **`Extended in Blendinar v1`** across Tasks 24–25, 29–32 (Spendable, Locked Refund, Merchant Payable, Accumulated Fees). |
| **Task 5 (`#10`)** | Admin shop balance loading (`adminLoadShopBalance`) and crash-rollback proof. | **`Completed (Baseline v0)`** | **`Superseded in Blendinar v1 by Task 25`** (Option B cash hand-in confirmation; legacy code cleanly replaced on `next-product` per `O-12 Confirmed`). |
| **Task 6 (`#11`)** | Merchant shop-float cash top-up (`merchantTopUp`) with `SELECT ... FOR UPDATE`. | **`Completed (Baseline v0)`** | **`Superseded in Blendinar v1 by Task 24`** (Employee Agent pending cash top-up; legacy code cleanly replaced on `next-product` per `O-12 Confirmed`). |
| **Task 7 (`#12`)** | Merchant 5-minute 6-character payment code generation, lookup, and password confirmation. | **`Completed (Baseline v0)`** | **`Evolved in Blendinar v1 by Tasks 28 & 29`** (External Merchant Hosted Checkout + configurable `2%` merchant fee). |
| **Task 8 (`#17`)** | Centralized limits (50k DA/tx, 100k DA/day, 200k DA max balance) in one central configuration file. | **`Planned` (Not yet built in `src/`)** | **`Aligned in Blendinar Milestone 6 (Task 8)`** (Customer & Agent caps resolved via `O-04 Delegated`; unverified merchant cap awaits `O-07`). |
| **Task 9 (`#13`)** | Idempotency keys (`idempotency_keys`), deterministic row-lock ordering, dual-800-DA race, and 50-request stress suite. | **`Partially Completed (Baseline v0)`** *(payment confirmation idempotency & dual-800-DA race done; global `key` uniqueness & 50-req stress incomplete)* | **`Completed via Task 16`** *(scoped `(user_id, endpoint, key)` idempotency, payload hashing, auth-before-replay, `pg_advisory_xact_lock` race fix & overflow guard — **Done**)*; remaining 50-request Blendinar stress + two-part conservation suite tracked in **`Task 34`**. |
| **Task 10 (`#14`)** | Customer-to-customer phone P2P transfer with recipient name preview. | **`Deferred / Future`** | **`Deferred / Future (Resolved via O-11 Delegated)`** — remains `Future` (excluded from v1). |
| **Task 11 (`#15`)** | Admin erroneous-transaction reversal appending offsetting ledger rows. | **`Deferred / Future`** | **`Deferred / Future`** (explicitly distinct from v1 Customer Unused-Balance Cash Refunds in Tasks 31–32). |
| **Task 12 (`#16`)** | Admin shop approval before operation and dedicated shop history/status endpoint. | **`Planned` (Not yet built in `src/`)** | **`Revised in Blendinar Milestone 5 (Task 12 / Task 27)`** (Merchant website/CCP onboarding, manual `Verified` vs `Unverified` status, merchant history). |
| **Task 13 (`#18`)** | React frontend for customer journey (sign-up, balance, history, payment confirmation). | **`Planned` (Starter card only in `src/client/App.jsx`)** | **`Aligned in Blendinar Milestone 9 (Task 13)`** (Customer portal, directory, agent trust view, 3-state balance, refunds, Hosted Checkout). |
| **Task 14 (`#19`)** | React frontend for merchant and admin portals. | **`Planned` (Starter card only in `src/client/App.jsx`)** | **`Aligned in Blendinar Milestone 9 (Task 14)`** (Agent portal, Merchant portal, and Admin operational dashboard). |
| **Task 15 (`#20`)** | One-command Docker Compose, GitHub Actions CI, README deployment guide, and public URL hosting. | **`Partially Completed (Baseline v0)`** *(Docker Compose & `main` CI done; public URL not deployed)* | **`CI on next-product moved to Task 17; Public URL deployment remains Deferred / Future`**. |

---

## Part 3 — Ordered Active Blendinar v1 Backlog (9 Milestones)

> **Lifecycle Note:** Before implementing any task below, follow `_docs/process.md`: check `Open` (`O-*`) decisions, pass PM grooming, Reviewer pre-implementation check (for sensitive tasks), Lyna Approval Gate, and respect **Mandatory Milestone Stop Points** after Milestones 4, 6, 7, 8, and each major frontend area in Milestone 9.

---

### Milestone 1 — Foundation, Security & Specification Alignment

#### Task 16: Scoped Idempotency Keys, Payload Check, Auth-Before-Replay, Race Fix & Centime Overflow Guard
- **Status:** `Completed (Blendinar v1 — Milestone 1)` *(verified on `next-product`: `10` test files, `148` passed, `drizzle/0004_elite_titania.sql`, `QA: PASS`, `REVIEW: APPROVE`)*
- **Goal:** Upgrade idempotency handling to composite `(user_id, endpoint, key)` scoping with payload hashing, auth/password verification before cached replay, in-transaction uniqueness conflict recovery, and the `Math.floor(Number.MAX_SAFE_INTEGER / 100)` overflow guard across all financial services.
- **In plain words:** Ensures two different customers or two different actions never collide if they use the same request ID, stops anyone from getting a cached payment receipt using a wrong password, and prevents huge numbers from overflowing JavaScript integer limits before multiplying by 100 centimes.
- **Product plan rules & requirements:** `_docs/plan.md` `R3`, `R12-B`, Checks `6`, `11`, `26`, `27`; `docs/03-concurrency-and-idempotency.md` Section 4 improvement notes.
- **User scenarios:**
  - *Happy path:* Customer A and Customer B both submit `Idempotency-Key: "retry-1"` for `3,000 DZD` confirmations -> both succeed independently without key collision. Customer A retrying `"retry-1"` with valid password receives the identical `200` receipt once.
  - *Failure:* Customer A retries `"retry-1"` with a **wrong password** -> receives `401 Invalid password` (never cached `200`). Customer A reuses `"retry-1"` on a different payment code or endpoint -> rejected (`409` payload mismatch). Submitting `90,071,992,547,410 DZD` (`> Math.floor(Number.MAX_SAFE_INTEGER / 100)`) -> rejected `400`.
- **Acceptance criteria:**
  - [x] **Schema & forward-only migration:** Replace global unique constraint on `idempotency_keys.key` with composite unique `(user_id, endpoint, key)` plus `request_hash` column via a new `drizzle/` migration (never editing existing migrations).
  - [x] **Auth & password before replay:** In `confirmPaymentRequest` and future idempotent financial endpoints, validate authentication/suspension and `bcrypt.compare(password, ...)` **before** returning any cached `idempotency_keys` record (`401`/`403` on failure).
  - [x] **Payload mismatch & concurrency race:** Reject same `(user_id, endpoint, key)` with differing `request_hash` (`409` or `422`); handle concurrent identical-key `Promise.all` requests inside `db.transaction` without `500` or double debit.
  - [x] **Integer overflow guard:** Reject any amount `> Math.floor(Number.MAX_SAFE_INTEGER / 100)` (as well as `<= 0`, floats, non-integers) with `400` in `src/services/wallet.js`, `src/services/payment.js`, and shared validation helper.
  - [x] **Preservation:** All existing tests remain green without relaxing assertions.
- **Out of scope:** New Blendinar endpoints (Tasks 19–32); 50-request Blendinar stress test (Task 34).
- **Dependencies:** Baseline Tasks 1–7, 9 partial.
- **Relevant existing implementation or files:** `src/db/schema.js` (`idempotencyKeys`), `src/services/payment.js` (`confirmPaymentRequest`, `createPaymentRequest`), `src/services/wallet.js` (`adminLoadShopBalance`, `merchantTopUp`), `tests/payment-concurrency.test.js`.
- **Constraints:** Work on `next-product` (never push to `main`); forward-only `drizzle/` migrations only; no new `package.json` dependencies.
- **Documentation & diagrams to update:** `docs/02-data-model-and-ledger.md` (ERD `idempotency_keys`), `docs/03-concurrency-and-idempotency.md` (Section 4 idempotency flow & removal of old limitation note).
- **Testing expectations:** Real-DB Vitest + Supertest tests covering cross-user same-key non-collision, cross-endpoint non-collision, payload mismatch rejection, wrong-password-before-replay (`401`), concurrent identical-key `Promise.all` race, and `Math.floor(Number.MAX_SAFE_INTEGER / 100) + 1` rejection; full `npm test` passes.
- **Open owner decisions:** `None`.

#### Task 17: CI Pipeline Branch Coverage (`next-product`) & Migration/Build Verification
- **Status:** `Completed (Blendinar v1 — Milestone 1)` *(verified on `next-product`: `QA: PASS`, `REVIEW: APPROVE`)*
- **Goal:** Configure `.github/workflows/ci.yml` to run PostgreSQL migrations, full `npm test`, and `npm run build` on pushes and PRs targeting `next-product` as well as `main` without disturbing the Cohort Baseline on `main`.
- **In plain words:** Automatically runs all database migrations, automated tests, and the React build check on our active Blendinar development branch (`next-product`) so regressions are caught immediately.
- **Product plan rules & requirements:** `_docs/process.md` repository safeguards (never alter Cohort Baseline on `main`; test against real PostgreSQL).
- **User scenarios:**
  - *Happy path:* Developer pushes a commit to `next-product` -> GitHub Actions boots PostgreSQL 16, runs `npx drizzle-kit migrate`, executes `npm test`, and runs `npm run build` cleanly.
  - *Failure:* A broken Drizzle migration or failing financial test causes CI on `next-product` to fail red before merge.
- **Acceptance criteria:**
  - [x] `.github/workflows/ci.yml` triggers on `push` and `pull_request` for `branches: [main, next-product]`.
  - [x] CI starts PostgreSQL 16, runs `npm ci`, applies `npx drizzle-kit migrate`, runs `npm test`, and builds React via `npm run build`.
  - [x] No hardcoded secrets or credentials added to workflow files.
- **Out of scope:** Public URL hosting deployment (Task 15 deferred); changing application logic.
- **Dependencies:** None.
- **Relevant existing implementation or files:** `.github/workflows/ci.yml`, `package.json`.
- **Constraints:** Only edit `.github/workflows/ci.yml` and relevant docs if needed; no `package.json` dependency additions.
- **Documentation & diagrams to update:** `docs/06-devops-testing-and-workflow.md` (CI branch note).
- **Testing expectations:** Verify workflow syntax and run `npm test` + `npm run build` locally after edit.
- **Open owner decisions:** `None`.

#### Task 18: Admin Seed Credential Hardening, Legacy Baseline Replacement (`O-12`) & Simulated-Money Branding
- **Status:** `Completed (Blendinar v1 — Milestone 1)` *(verified on `next-product`: `11` test files, `155` passed, `npm run build` passed, `QA: PASS`, `REVIEW: APPROVE`)*
- **Goal:** Remove any hardcoded fallback admin credentials or weak fallback secrets in runtime/seed scripts, establish clean Blendinar v1 replacement of Cohort v0 shop-float & phone-mandatory code on `next-product` per **`O-12 (Confirmed)`**, and add Blendinar branding + persistent simulated-money notice to starter app shell.
- **In plain words:** Secures how the initial admin account and login tokens are configured (reading from environment variables instead of hardcoded defaults), keeps Cohort Baseline v0 untouched on `main` while cleanly replacing legacy shop-float code on `next-product`, and stamps Blendinar's simulated-money notice onto the starter app.
- **Product plan rules & requirements:** `_docs/plan.md` Simulated-Money Notice, `O-12` (`Confirmed`); `_docs/design-system.md` Section 2A; `AGENTS.md` safeguards.
- **User scenarios:**
  - *Happy path:* Operator starts stack with env-configured `ADMIN_EMAIL` / `ADMIN_PASSWORD` and `JWT_SECRET` -> `npm run seed:admin` creates admin idempotently; UI displays Blendinar + fake-money banner; legacy shop-float endpoints are cleanly retired on `next-product` (not left as dead parallel routes) while `drizzle/0000`–`0003` remain immutable.
  - *Failure:* Running `NODE_ENV=production` without `JWT_SECRET` or running `seed-admin.js` without env admin credentials fails loudly with a clear startup error rather than falling back to hardcoded weak secrets.
- **Acceptance criteria:**
  - [x] `src/scripts/seed-admin.js` reads admin credentials solely from environment variables (never hardcoded password/phone fallback in code or docs) and fails cleanly if missing.
  - [x] `src/middleware/auth.js` refuses default dev JWT fallback when `NODE_ENV === 'production'`.
  - [x] On `next-product`, legacy shop-float code (`adminLoadShopBalance`, `merchantTopUp`, phone-mandatory auth) is retired/replaced cleanly across Milestones 1–4 without touching `main` or editing `drizzle/0000`–`0003`.
  - [x] `index.html` and `src/client/App.jsx` display **Blendinar** title and visible *"100% fake/simulated DZD"* notice.
- **Out of scope:** Full customer/agent/merchant/admin React portals (Tasks 13–14).
- **Dependencies:** Task 16, Task 17.
- **Relevant existing implementation or files:** `src/scripts/seed-admin.js`, `src/middleware/auth.js`, `index.html`, `src/client/App.jsx`, `.env.example`.
- **Constraints:** Never commit `.env` or real credentials; never touch `main` or edit existing `drizzle/0000`–`0003` migrations; only new forward-only migration if needed.
- **Documentation & diagrams to update:** `README.md`, `docs/04-security-auth-and-rbac.md`, `docs/06-devops-testing-and-workflow.md` (ensuring zero hardcoded credentials remain).
- **Testing expectations:** Automated tests verifying missing-secret guard in `NODE_ENV=production`, idempotent env-driven admin seed, and full `npm test` pass.
- **Open owner decisions:** `None` (`O-12` Confirmed: clean replacement on `next-product` while keeping `main` Cohort v0 untouched and `drizzle/0000`–`0003` immutable).

---

### Milestone 2 — Customer Identity & Account Foundation

#### Task 19: Email-First Customer Registration, Simulated Email OTP & Optional Phone Backup Recovery
- **Status:** `Ready for Grooming / Active Blendinar v1`
- **Goal:** Migrate registration, simulated OTP verification, and login from phone-required to **email-required + simulated 6-digit email OTP**, keeping phone strictly **optional** (`NULL`-normalized for phone-less tourists) and enabling verified-phone backup recovery OTP (`O-01 Confirmed`).
- **In plain words:** Lets tourists and foreigners without an Algerian SIM card sign up using just their email address and a simulated 6-digit email code (`DEMO_MODE`), while allowing customers who optionally verify a phone number to use a simulated phone recovery code if they ever lose email access.
- **Product plan rules & requirements:** `_docs/plan.md` `R7-B`, Check `15`–`16`, `O-01` (`Confirmed`).
- **User scenarios:**
  - *Happy path (Scenario 1 part 1):* Tourist Amira registers with `amira@example.com`, `"Amira"`, password, and no phone -> receives simulated 6-digit email OTP `482910` (via `sendOtp` / `GET /api/auth/otp/:email` when `DEMO_MODE=true`) -> verifies OTP -> `0 DZD` Spendable Balance initialized -> logs in with email + password (`200` + JWT). A second tourist registers with `""` (empty phone) -> normalized to `NULL`, no uniqueness conflict. Later, if Amira optionally adds and verifies her phone `0550112233` and loses email access, she can request a 6-digit simulated recovery OTP to `0550112233` to recover access / reset password.
  - *Failure:* Duplicate verified email -> `409`; wrong/expired/used email or recovery OTP -> `400`; unverified or missing phone requesting phone recovery -> `400`/`404`; invalid email format or `< 6`-char password -> `400`; `NODE_ENV=production` with `DEMO_MODE` unset -> simulated OTP endpoints return `404` and log nothing; `role: 'admin'` or `'agent'` -> `403`.
- **Acceptance criteria:**
  - [ ] Forward-only `drizzle/` migration adds `email` (`NOT NULL UNIQUE` normalized lowercase), makes `phone` nullable (`UNIQUE` when non-null, normalizing `""`/`undefined` to `NULL`), adds `phone_verified` boolean, and updates `otp_codes` for `email` / verified `phone` + purpose (`register` | `recovery`).
  - [ ] `POST /api/auth/register` requires valid email + name + password (`>= 6`), does **not** require phone, rejects `role === 'admin'` (`403`), and allows re-registering an unverified email to reissue OTP.
  - [ ] `sendOtp` in `src/services/otp.js` preserves single-function pluggable boundary and `isOtpExposed()` (`DEMO_MODE=true` or non-production only).
  - [ ] `POST /api/auth/verify-otp` atomically marks OTP used, verifies email, and creates `0`-centime wallet.
  - [ ] Optional verified-phone backup recovery flow (`verify-phone` + `recover-password` via simulated 6-digit OTP) works in `DEMO_MODE` and rejects unverified phones (`O-01 Confirmed`).
  - [ ] `POST /api/auth/login` authenticates by email + password and returns JWT `{ id, email, name, role }`.
- **Out of scope:** Passport KYC check (Task 20); real SMTP/SMS provider integration (`Future`); account suspension (Task 21).
- **Dependencies:** Task 16, Task 18.
- **Relevant existing implementation or files:** `src/db/schema.js`, `src/routes/auth.js`, `src/services/otp.js`, `tests/auth-register.test.js`, `tests/otp-demo-mode.test.js`, `tests/auth-login.test.js`.
- **Constraints:** Forward-only migrations only; do not require both email and phone; no new packages without approval.
- **Documentation & diagrams to update:** `docs/01-system-architecture.md` (auth & recovery endpoints), `docs/02-data-model-and-ledger.md` (ERD `users`, `otp_codes`), `docs/04-security-auth-and-rbac.md` (email + recovery OTP sequence diagram).
- **Testing expectations:** Real-DB tests for email registration with `null`/`""`/omitted phone across multiple phone-less users, duplicate verified email `409`, optional phone uniqueness & verified-phone recovery OTP, `DEMO_MODE` vs production `404` isolation, and full `npm test` pass.
- **Open owner decisions:** `None` (`O-01` Confirmed: phone optional at registration; verified optional phone supports backup account recovery / password reset).

#### Task 20: Two-Step Hybrid Passport KYC — Customer ICAO MRZ Pre-Scan + Agent Physical Check (`O-02`)
- **Status:** `Ready for Grooming / Active Blendinar v1`
- **Goal:** Implement Blendinar's **two-step hybrid passport-only verification** workflow (`R7-C`, `O-02 Confirmed` workaround) separately from email OTP and cash top-ups: **Step 1** (customer in-app ICAO MRZ pre-scan validating check digits, expiry, name match, and unique SHA-256 `(issuing_country, passport_number)` without storing raw photos -> `prechecked_pending_agent`) and **Step 2** (Agent physical passport double-check side-by-side at first cash top-up with one-click Approve/Reject, zero manual Agent typing).
- **In plain words:** Gives the best of speed and real-world safety: the customer scans/enters their passport MRZ in the app first (blocking fake/duplicate passports and keeping zero photos), and when they show up for their first cash top-up, the Agent simply compares the pre-checked details shown on screen against the physical passport and clicks Approve or Reject without typing passport numbers manually.
- **Product plan rules & requirements:** `_docs/plan.md` `R7-C`, Check `17`, `O-02` (`Confirmed` workaround).
- **User scenarios:**
  - *Happy path (Scenario 1 part 2):* Amira is email-verified (`email_verified = true`, `passport_verified = false`). Before her first cash top-up, she completes **Step 1** in-app with her simulated 2-line ICAO MRZ -> parser validates standard check digits, expiry, and name match, confirms unique `SHA-256(issuing_country + ':' + passport_number)`, saves masked hint + country + expiry (zero raw photo stored), and sets status to `prechecked_pending_agent`. At her first cash top-up (**Step 2**), Agent views Amira's pre-checked summary side-by-side, checks Amira's physical passport, and clicks **Approve** -> `passport_verified = true` (Stage 3 top-up unlocked + customer notified).
  - *Failure:* Malformed MRZ or failing check digits -> `400`. Expired passport -> `400`. Second account submitting same `(issuing_country, passport_number)` -> `409` duplicate passport rejected. Name-mismatch anomaly -> routed to `pending_admin_review`. Agent clicking **Reject** without mandatory reason -> `400`; with reason -> sets `passport_rejected` (notifies customer & blocks top-ups). Customer with `unverified_passport`, `prechecked_pending_agent`, or `passport_rejected` attempting top-up -> rejected `400`/`403`.
- **Acceptance criteria:**
  - [ ] Forward-only migration creates `passport_verifications` storing `passport_hash` (`NOT NULL UNIQUE` SHA-256 of normalized `(issuing_country, passport_number)`), `masked_hint`, `issuing_country`, `expires_at`, `verified_by_agent_id`, `rejection_reason`, `verification_status` (`prechecked_pending_agent` | `verified` | `passport_rejected` | `pending_admin_review`), and zero raw photo/image columns.
  - [ ] Step 1 pure ICAO MRZ parser/validator verifies standard 2-line TD3 format, mathematical check digits (document number, birth date, expiry, composite), non-expired date, and name match, setting `prechecked_pending_agent` (or `pending_admin_review` on anomaly).
  - [ ] Step 2 Agent physical check endpoint allows active `agent` (or `admin` on review) to view pre-checked masked summary side-by-side and click **Approve** (`passport_verified = true`) or **Reject** (requires mandatory `rejection_reason`, sets `passport_rejected`); `customer`/`merchant` calls return `403`.
  - [ ] Stage 1 (`email_verified`), Stage 2 (2-step MRZ pre-scan -> Agent Approve/Reject), and Stage 3 (cash top-up eligibility) remain cleanly separated in DB and API responses; suspended customers rejected `403`.
- **Out of scope:** Real third-party camera OCR API integration (`Future`); National ID cards (`Future`); real-world legal sufficiency (`Unverified`).
- **Dependencies:** Task 19 *(Step 2 Agent approval endpoint binds cleanly to Task 22 `agent` role in M3; Admin review works immediately in M2)*.
- **Relevant existing implementation or files:** `src/db/schema.js`, `src/routes/customer.js`, `src/routes/agent.js`, `src/routes/admin.js`, new `src/services/passport-mrz.js`.
- **Constraints:** Never store raw passport scan photos; zero manual passport number entry required from Agents in Step 2; deterministic SHA-256 `(issuing_country, passport_number)` uniqueness; forward-only migrations; no unauthorized npm dependencies.
- **Documentation & diagrams to update:** `docs/02-data-model-and-ledger.md` (`passport_verifications`), `docs/04-security-auth-and-rbac.md` (Section 5.2 & 5.6 2-step hybrid KYC flow).
- **Testing expectations:** Real-DB + unit tests covering valid Step 1 ICAO MRZ check-digits (`prechecked_pending_agent`), bad check-digit/expired rejection (`400`), duplicate SHA-256 passport collision (`409`), name-mismatch routing to `pending_admin_review`, Step 2 Agent Approve enabling top-up vs Reject requiring reason (`400` without reason, blocking top-up & sending status notification), `403` RBAC on Step 2, top-up block prior to Step 2 approval, zero photo storage, and full `npm test` pass.
- **Open owner decisions:** `None` (`O-02` Confirmed workaround: 2-step hybrid — customer in-app ICAO MRZ pre-scan + Agent physical double-check Approve/Reject at first top-up with SHA-256 uniqueness & zero raw photo storage).

#### Task 21: Customer Account Status (`active` / `suspended`), Live `requireAuth` Enforcement & Read-Only Mode (`O-03`)
- **Status:** `Ready for Grooming / Active Blendinar v1`
- **Goal:** Add `status` (`active` / `suspended`) on accounts, update `requireAuth` to check live database status on authenticated requests, allow suspended customers **Read-Only login** (`GET` profile, separated 3 balances, transaction history, reason/appeal notice), and block all financial/state-changing mutations (`403 Account suspended`) while holding in-flight items for Admin review (`O-03 Confirmed`).
- **In plain words:** Lets an Admin freeze an abusing customer's account so they can still log in and clearly see that their money and history are preserved (Read-Only Mode), while immediately blocking any spending, top-ups, refunds, or edits (`403`).
- **Product plan rules & requirements:** `_docs/plan.md` `R15`, Scenario `10`, Check `32`, `O-03` (`Confirmed`).
- **User scenarios:**
  - *Happy path (Scenario 10):* Customer Karim has `2,000 DZD` Spendable Balance and 3 transactions. Admin suspends Karim (`status: 'suspended'`, reason logged). Karim logs in (or uses existing JWT) on `GET /api/customer/balance` and `GET /api/customer/transactions` -> receives `200` Read-Only data plus suspension reason/appeal banner showing his `2,000 DZD` balance and 3 transactions are intact.
  - *Failure:* Karim attempts `POST` checkout confirmation, `POST` refund request, or profile edit with his JWT -> `requireAuth` live DB status check immediately returns `403 Account suspended`. Any in-flight pending top-ups or locked refunds remain held for Admin review. Non-admin calling Admin suspend/reactivate -> `403`.
- **Acceptance criteria:**
  - [ ] Forward-only migration adds `status` (`active` | `suspended`), `suspended_at`, `suspended_reason`, `suspended_by` on `users`.
  - [ ] `requireAuth` in `src/middleware/auth.js` queries live `users.status` and attaches live status; Read-Only `GET` account/balance/history endpoints succeed for suspended users with suspension status/reason metadata, while all financial and state-changing endpoints reject `suspended` users with `403 Account suspended` (before idempotency replay).
  - [ ] Admin suspend/reactivate endpoints record immutable audit events, leave in-flight pending top-ups/locked refunds held for Admin review, and **never** modify wallet balances or ledger rows.
- **Out of scope:** Automatic algorithmic bans (`Confirmed` prohibited — Admin review only).
- **Dependencies:** Task 16, Task 19.
- **Relevant existing implementation or files:** `src/db/schema.js`, `src/middleware/auth.js` (`requireAuth`), `src/routes/admin.js`, `src/routes/customer.js`, `tests/rbac.test.js`.
- **Constraints:** Forward-only migrations; preserve balances & append-only ledger strictly.
- **Documentation & diagrams to update:** `docs/04-security-auth-and-rbac.md` (Read-Only suspension flow), `docs/01-system-architecture.md` (admin suspension endpoints).
- **Testing expectations:** Real-DB tests proving Read-Only `GET` access works with suspension notice, immediate `403` rejection of pre-existing valid JWTs on all mutations/payments/refunds upon suspension, in-flight hold + balance & ledger preservation on `2,000 DZD` account, non-admin `403`, and full `npm test` pass.
- **Open owner decisions:** `None` (`O-03` Confirmed: Read-Only login allowed; all financial/state-changing actions `403`; in-flight pending top-ups & locked refunds held for Admin review).

---

### Milestone 3 — Agent & Office Foundation

#### Task 22: Employee `agent` Role (`R2-B`), Fixed Offices vs. Individual Agents & `50k`/`250k` Exposure Limits (`O-04`)
- **Status:** `Ready for Grooming / Active Blendinar v1`
- **Goal:** Introduce Blendinar's 4th role (`agent`) with two employee categories (`fixed_office` / "Partner Point" vs. `individual`), Admin agent/office management endpoints, and centralized **Agent Cash Exposure Limits** (`50,000 DZD` Individual Agents; `250,000 DZD` Fixed-Location Offices per `O-04 Delegated`) — explicitly NOT a prepaid float.
- **In plain words:** Adds Blendinar employee Agents and physical Blendinar offices to the platform with `50,000 DZD` exposure limits for mobile Individual Agents and `250,000 DZD` limits for higher-security Fixed-Location Offices.
- **Product plan rules & requirements:** `_docs/plan.md` `R2-B`, `R5-B`, `R8-B`, Checks `18`, `33`, `O-04` (`Delegated`).
- **User scenarios:**
  - *Happy path:* Admin creates Fixed-Location Office `"Algiers Center Partner Point"` and assigns an employee `agent` with verification identifier `AG-014` (`cash_exposure_limit: 25000000` centimes = `250,000 DZD`). Admin creates an Individual Agent (`cash_exposure_limit: 5000000` centimes = `50,000 DZD`). Agents log in and view their assignment and `0 DZD` exposure.
  - *Failure:* Self-registration with `role: 'agent'` via public `POST /api/auth/register` -> `403`. Customer or merchant calling `/api/agent/*` or Admin agent-creation routes -> `403`. Agent attempting to collect cash beyond `50,000 DZD` (Individual) or `250,000 DZD` (Fixed Office) -> rejected `400`.
- **Acceptance criteria:**
  - [ ] Forward-only migration updates user role enum (`customer`, `agent`, `merchant`, `admin`) and creates `offices` / `agent_profiles` tables with `agent_type` (`fixed_office` | `individual`), unique `verification_code`, location/hours/contact fields, `active` flag, and default exposure limits (`50,000 DZD` Individual / `250,000 DZD` Fixed Office, admin-configurable).
  - [ ] `POST /api/auth/register` restricts public sign-up to `customer`/`merchant` (`403` for `agent` and `admin`); only `admin` onboards employee agents.
  - [ ] `requireRole` enforces 4-role RBAC cleanly across `/api/customer`, `/api/agent`, `/api/merchant`, `/api/admin`.
  - [ ] Agent Cash Exposure Limit is strictly modeled as unconfirmed cash cap (`0` initial exposure), **never** as a spendable prepaid wallet balance.
- **Out of scope:** Agent salary, payroll, or commission calculation (`Confirmed` excluded from v1); automated customer-to-agent matching & in-app scheduling (`Future`).
- **Dependencies:** Task 19, Task 21.
- **Relevant existing implementation or files:** `src/db/schema.js`, `src/middleware/auth.js`, `src/routes/auth.js`, `src/routes/admin.js`, `tests/rbac.test.js`.
- **Constraints:** Forward-only migrations; no new packages; no hardcoded agent/admin passwords in docs.
- **Documentation & diagrams to update:** `docs/01-system-architecture.md` (`/api/agent/*`, 4-role RBAC), `docs/02-data-model-and-ledger.md` (ERD `offices`, `agent_profiles`), `docs/04-security-auth-and-rbac.md` (4-role permission matrix).
- **Testing expectations:** Real-DB RBAC tests across all 4 roles (`401`/`403`), rejection of self-registered `agent`, office/agent creation with `50k`/`250k` caps, status toggle tests, and full `npm test` pass.
- **Open owner decisions:** `None` (`O-04` Delegated resolved: `50,000 DZD` Individual Agent / `250,000 DZD` Fixed-Location Office exposure limits).

#### Task 23: Customer-Facing Agent & Office Directory and In-App Agent Trust Verification
- **Status:** `Ready for Grooming / Active Blendinar v1` *(depends on Task 22)*
- **Goal:** Provide the customer-facing Agent & Office Directory endpoint (showing locations, hours, and external contact details) plus an authenticated in-app Agent Identity Verification lookup so customers never rely on physical badges or screenshots.
- **In plain words:** Lets tourists find nearby Blendinar offices or individual agents, contact them to meet, and verify inside their own logged-in Blendinar app that the person in front of them is a genuine active Blendinar employee.
- **Product plan rules & requirements:** `_docs/plan.md` `R8-B`, Section `6.3`, Check `18`.
- **User scenarios:**
  - *Happy path:* Logged-in customer Amira queries the Agent Directory -> sees active Fixed-Location Offices and Individual Agents (name, `fixed_office`/`individual` type, address/area, hours, external contact, verification code) with inactive/suspended agents hidden. Amira verifies agent code `AG-014` in-app and sees `"Active Fixed-Location Office Agent — Algiers Center Partner Point"` plus anti-screenshot safety warning.
  - *Failure:* Suspended or deactivated agent lookup returns inactive warning / not selectable; unauthenticated user calling private verification details -> `401`.
- **Acceptance criteria:**
  - [ ] Directory endpoint returns only active agents/offices with role type (`fixed_office` | `individual`), office address/area, opening hours, external contact info, and public verification identifier (never sensitive internal data or password hashes).
  - [ ] Authenticated customer verification endpoint resolves agent code/ID and surfaces active status, verified name, office/role type, and explicit anti-impersonation notice payload.
  - [ ] Suspended or deactivated agents are excluded from active directory listings and flagged invalid if looked up directly.
- **Out of scope:** In-app chat, appointment booking, GPS auto-matching (`Future`).
- **Dependencies:** Task 22.
- **Relevant existing implementation or files:** `src/routes/customer.js`, `src/routes/agent.js` (new), `src/db/schema.js`.
- **Constraints:** Never expose private agent credentials or customer PII; stay within `src/routes/` and `src/services/`.
- **Documentation & diagrams to update:** `docs/01-system-architecture.md` (directory & verification API table).
- **Testing expectations:** Real-DB tests verifying active vs. inactive/suspended filtering, PII-safe serialization, `401` on unauthenticated calls, and full `npm test` pass.
- **Open owner decisions:** `None`.

---

### Milestone 4 — Cash Top-Up & Hand-In Flow (Option B) `[MANDATORY MILESTONE STOP POINT]`

> **Milestone Stop Point:** Upon completing Tasks 24–26, **STOP and obtain Lyna's review and approval** before starting Merchant Payment flows.

#### Task 24: Fixed Top-Up Presets & Agent Cash-Receipt Recording (Pending, Non-Spendable)
- **Status:** `Ready for Grooming / Active Blendinar v1`
- **Goal:** Implement admin-configurable fixed cash top-up presets (`[1,000; 2,000; 5,000; 10,000; 20,000]` DZD per `O-04 Delegated`) and the Agent cash-collection endpoint creating **Pending (Not Yet Spendable)** top-up records subject to Agent Cash Exposure Limits (`50k`/`250k` DZD), Customer Wallet Cap (`Spendable + Pending + NewTopUp <= 200,000 DZD`), and Passport MRZ KYC gate (`O-02 Confirmed`).
- **In plain words:** When a passport-verified customer hands `5,000 DZD` cash to an agent, the agent records it and the customer immediately sees `5,000 DZD Pending (Not yet spendable)` in their own app—without letting anyone spend it before the agent delivers the cash to Admin, and preventing wallet caps from ever being exceeded at release time.
- **Product plan rules & requirements:** `_docs/plan.md` `R5-B`, `R7-C`, `R8-B`, Scenarios `2`–`3`, Checks `17`–`19`, `O-02` (`Confirmed`), `O-04` (`Delegated`), `O-05` (`Confirmed`).
- **User scenarios:**
  - *Happy path (Scenarios 2 & 3):* Passport-verified customer Amira (`Spendable: 0, Pending: 0`) hands `5,000 DZD` (selected from `[1k, 2k, 5k, 10k, 20k]` presets) to active Agent `AG-014` (`exposure: 0 / 250,000 DZD`). Agent records `5,000 DZD` top-up -> creates `top_ups` row (`status: pending_hand_in`, `amount: 500000` centimes), raises Agent's unconfirmed exposure by `5,000 DZD`, leaves Amira's `Spendable Balance = 0 DZD` and shows `Pending Top-Ups = 5,000 DZD` with Agent `AG-014` details. Amira tries to pay `2,000 DZD` -> rejected `400 Insufficient spendable balance`.
  - *Failure:* Non-preset amount (`3,500 DZD` or `0` or `-1,000`) -> `400`; unverified-passport customer (`passport_verified = false`) or suspended customer -> `400`/`403`; top-up pushing customer `Spendable + Pending + NewTopUp > 200,000 DZD` -> `400`; top-up exceeding Agent Cash Exposure Limit (`50k`/`250k` DZD) -> `400`; Agent topping up themselves or non-customer account -> `400`; concurrent `Promise.all` top-ups exceeding Agent Cash Exposure Limit -> `SELECT ... FOR UPDATE` allows only up to cap.
- **Acceptance criteria:**
  - [ ] Forward-only migration creates `top_ups` (`pending_hand_in`, `confirmed`, `shortage_hold`, `disputed`, `voided` as approved) and `platform_config` preset/limit settings.
  - [ ] Validates `amountDinars` against integer centimes, `Math.floor(Number.MAX_SAFE_INTEGER / 100)`, and centralized active preset list (`400` otherwise).
  - [ ] Atomically locks Agent profile/exposure row and Customer wallet (`SELECT ... FOR UPDATE`), verifies `passport_verified = true`, active status, `currentExposure + amount <= exposureLimit` (`50k`/`250k`), and `Spendable + Pending + NewTopUp <= 200,000 DZD`, records `pending_hand_in` top-up, and increments `A_collected_valid` / `T_pending` without modifying Spendable Balance (`0` spendable credit).
  - [ ] Customer balance endpoint returns **separate** `spendableBalanceDinars`, `pendingTopUpsDinars` (with pending items & agent identity), and `lockedRefundBalanceDinars` (never merged).
- **Out of scope:** Custom arbitrary amounts (`Future`); Option A / Option C instant float top-ups (`Future`); Admin hand-in release (Task 25).
- **Dependencies:** Task 16, Task 20, Task 22, Task 23.
- **Relevant existing implementation or files:** `src/db/schema.js`, `src/services/wallet.js`, `src/routes/customer.js`, new `src/services/topup.js` & `src/routes/agent.js`.
- **Constraints:** Forward-only migrations; `dinars * 100` integer centimes; no negative exposure or spendable leak.
- **Documentation & diagrams to update:** `docs/01-system-architecture.md`, `docs/02-data-model-and-ledger.md` (ERD `top_ups`), `docs/03-concurrency-and-idempotency.md` (exposure lock).
- **Testing expectations:** Real-DB tests for preset acceptance/rejection, zero spendable leak on pending top-up, customer payment rejection against pending balance, `Spendable + Pending + NewTopUp > 200,000 DZD` rejection, concurrent `Promise.all` exposure-cap race (`50k`/`250k`), passport/suspension negative checks, and full `npm test` pass.
- **Open owner decisions:** `None` (`O-02`, `O-04`, `O-05` all resolved).

#### Task 25: Agent Cash Hand-In Submission & Admin Hand-In Confirmation (Option B Release)
- **Status:** `Blocked on Owner Decision (Section 5.6 Conservation Approval)` *(also depends on Task 24)*
- **Goal:** Implement Option B Agent cash hand-in submission and Admin hand-in confirmation so customer Spendable Balances are credited **only** inside an atomic, row-locked PostgreSQL transaction when Admin confirms receiving the physical cash.
- **In plain words:** The only way spendable digital money enters Blendinar: an employee Agent hands physical cash to Admin, Admin clicks confirm in the system, and the waiting customers' Pending Top-Ups immediately unlock into Spendable Balance.
- **Product plan rules & requirements:** `_docs/plan.md` `R8-B`, Section `5.6`, Scenario `4`, Check `20`, `O-04` (`Delegated` resolved).
- **User scenarios:**
  - *Happy path (Scenario 4):* Agent `AG-014` submits a hand-in batch containing Amira's `5,000 DZD` pending top-up. Admin confirms `5,000 DZD` received -> inside one `SELECT ... FOR UPDATE` transaction, hand-in and top-up transition `pending_hand_in -> confirmed`, Amira's Spendable Balance increases from `0` to `5,000 DZD`, `Pending Top-Ups` drops to `0`, Agent cash exposure drops by `5,000 DZD`, and immutable ledger row is appended.
  - *Failure:* Agent or customer tries to confirm hand-in -> `403`. Two Admins simultaneously submit confirmation for the same batch (`Promise.all`) -> **exactly one** succeeds (`200`), the second rejects cleanly (`400`/`409`), Amira receives `5,000 DZD` once only. Simulated crash via `_testFailureAfterBalanceUpdate` rolls back everything cleanly.
- **Acceptance criteria:**
  - [ ] Forward-only migration creates `cash_hand_ins` table linking Agent, Admin confirmer, expected vs. confirmed centime amounts, status, and linked `top_ups`.
  - [ ] Admin confirmation uses deterministic `SELECT ... FOR UPDATE` ordering across hand-in, linked top-ups, agent exposure, and customer wallets.
  - [ ] Transitions linked `top_ups` to `confirmed`, credits customer Spendable Balance, lowers Agent unconfirmed exposure, and appends immutable `transactions` ledger entries.
  - [ ] Re-verifies `Spendable <= 200,000 DZD` cap inside the lock (`O-04 Delegated` — prevented at recording time too).
  - [ ] Concurrent double-confirm (`Promise.all`) and `_testFailureAfterBalanceUpdate` rollback tests pass cleanly; Part 1 & Part 2 conservation holds.
- **Out of scope:** Cash shortage allocation rules (Task 26); Agent commissions/payroll (`Confirmed` out of scope).
- **Dependencies:** Task 24, formal Lyna approval of `_docs/plan.md` Section 5.6 conservation model.
- **Relevant existing implementation or files:** `src/db/schema.js`, `src/routes/admin.js`, `src/routes/agent.js`, `src/services/wallet.js`, `src/services/topup.js`.
- **Constraints:** Strict `admin`-only confirmation (`403` for `agent`/`merchant`/`customer`); append-only ledger; forward-only migrations.
- **Documentation & diagrams to update:** `docs/02-data-model-and-ledger.md`, `docs/03-concurrency-and-idempotency.md` (Option B confirmation sequence diagram).
- **Testing expectations:** Real-DB tests for single & multi-customer release, `Promise.all` double hand-in confirmation race, `_testFailureAfterBalanceUpdate` rollback, `403` non-admin checks, two-part conservation assertion, and full `npm test` pass.
- **Open owner decisions:** Formal Lyna sign-off on `_docs/plan.md` **Section 5.6** (Two-Part Financial Conservation Invariant). *(`O-04` resolved as `Delegated`.)*

#### Task 26: Hand-In Cash Shortages (`shortage_hold` Batch Hold), Discrepancy Audit Records & Risk Flags (`O-05`)
- **Status:** `Ready for Grooming / Active Blendinar v1` *(depends on Task 25)*
- **Goal:** Handle Agent cash hand-in discrepancies (when physical cash delivered is less than recorded collections) by placing **the entire short batch into `shortage_hold` with zero ambiguous top-ups released** until Admin explicitly reconciles cash-backed receipts (`O-05 Confirmed`), recording immutable shortage audits, and raising **informational-only** risk flags (never automated bans).
- **In plain words:** If an agent collected `15,000 DZD` from three customers but only hands in `10,000 DZD`, Blendinar holds the entire batch in `shortage_hold` and releases zero ambiguous top-ups until an Admin investigates and specifies which customer receipts are cash-backed—preventing favoritism or unbacked money creation.
- **Product plan rules & requirements:** `_docs/plan.md` `R8-B`, Section `5.6`, Section `6.4` Scenario `5`, Check `21`, `O-05` (`Confirmed`).
- **User scenarios:**
  - *Happy path / Shortage (Scenario 5):* Agent collected `15,000 DZD` (`3 × 5,000 DZD`) and hands in `10,000 DZD`. Admin enters `10,000 DZD` actual cash received -> system records `5,000 DZD` shortage, places the **entire 3-top-up batch into `shortage_hold`** with `0 DZD` released to any customer yet, creates an informational risk flag for Admin review, and preserves `A_collected_valid = T_pending + H_confirmed`. Later, Admin reconciles and releases verified cash-backed receipts explicitly.
  - *Failure:* Admin submitting negative cash received or cash exceeding expected batch without explicit resolution workflow -> `400`; automated check attempting to auto-ban Agent/Customer -> prohibited (`Confirmed`: flags only, Admin decides).
- **Acceptance criteria:**
  - [ ] Hand-in reconciliation records `expected_amount`, `received_amount`, and `shortage_amount` in integer centimes, rejecting negative/invalid inputs (`400`).
  - [ ] On any shortage (`received_amount < expected_amount`), transitions the **entire batch and all linked top-ups to `shortage_hold`** and credits **`0` spendable Dinars** (`O-05 Confirmed`), preserving Part 1 & Part 2 conservation.
  - [ ] Generates **informational risk flags** (shortages, overdue un-handed-in cash, unusually high exposure) visible in Admin audit queue — **never** automatically suspending/banning users.
  - [ ] Admin explicit shortage-reconciliation endpoint releases only explicitly confirmed cash-backed receipts (`<= received_amount`) and preserves append-only financial truth.
- **Out of scope:** Automated AI/ML fraud scoring (`Dropped`); Agent employment/payroll deductions (`Confirmed` excluded).
- **Dependencies:** Task 25.
- **Relevant existing implementation or files:** `src/services/topup.js`, `src/routes/admin.js`, `src/db/schema.js`.
- **Constraints:** Software must never auto-ban on shortage flags; forward-only migrations; integer centimes only.
- **Documentation & diagrams to update:** `docs/02-data-model-and-ledger.md` (shortage audit fields), `docs/03-concurrency-and-idempotency.md`.
- **Testing expectations:** Real-DB tests covering Scenario 5 (`15,000` vs `10,000` DZD shortage placing entire batch in `shortage_hold`), zero ambiguous release, explicit Admin reconciliation up to confirmed cash, two-part conservation assertion, RBAC `403`, and full `npm test` pass.
- **Open owner decisions:** `None` (`O-05` Confirmed: entire short batch enters `shortage_hold` with zero ambiguous releases until Admin reconciles cash-backed receipts).

---

### Milestone 5 — Merchant Foundation & Website Integration

#### Task 12 / Task 27: External Merchant Onboarding, B2B Subscription Setup, Manual Verification & History View
- **Status:** `Ready for Grooming / Active Blendinar v1` *(replaces Cohort Baseline Task 12 shop-float approval)*
- **Goal:** Evolve `merchant` onboarding to require an external website URL, business category, CCP payout details, and optional Instagram/contact info; support manual Admin verification (`Verified Merchant` vs. `Unverified Merchant`); create & track **Stream 1** `merchant_subscriptions` (`active | past_due | canceled`, configurable **`2,000 DZD/month`** default confirmed by Admin per `O-06b`, strictly outside customer wallet funds); and provide merchant balance & history endpoints.
- **In plain words:** Lets online stores with real websites register to accept Blendinar, initializes and tracks their separate `2,000 DZD/month` platform subscription (`O-06b`), keeps newly registered stores marked `Unverified` until an Admin checks them manually, and lets merchants inspect their payable earnings, subscription status/renewal banner, and history.
- **Product plan rules & requirements:** `_docs/plan.md` `R6-B`, `R9-B`, Section `6.5` & `6.10`, Check `22`, `O-06b` (`Confirmed` / `Delegated`), `O-07`.
- **User scenarios:**
  - *Happy path:* Store `"Sahara Crafts"` registers with `https://saharacrafts.dz`, category `"Retail"`, CCP account details, and optional `@saharacrafts` -> starts `verification_status: 'unverified'` with initial `merchant_subscriptions` (`monthly_fee_centimes: 200000`, `status: 'active'` or pending initial confirmation, Admin-managed). Admin reviews store website/details, marks it `verified`, and confirms/renews monthly B2B subscription periods (`2,000 DZD/month`). Merchant queries `/api/merchant/dashboard` & `/api/merchant/transactions` -> sees `Verified Merchant`, `subscription_active` badge, Merchant Payable Balance, and isolated sales/payout ledger.
  - *Failure:* Merchant submits registration without website URL (Instagram-only) or invalid URL (`javascript:...`) -> `400`. When `merchant_subscriptions.status` expires to `past_due`, renewal warning banner/reminder fires cleanly without deducting from `merchant_payable_balance`. Merchant A tries to read Merchant B's transactions -> isolated (`403`). Non-admin tries to verify a merchant or confirm subscription renewal -> `403`.
- **Acceptance criteria:**
  - [ ] Forward-only migration creates `merchant_profiles` (`business_name`, `website_url` validated `http`/`https`, `category`, `ccp_account_details`, `instagram_handle`, `verification_status` `unverified | verified`) and separate `merchant_subscriptions` (`merchant_id`, `monthly_fee_centimes` default `200000`, `status` `active | past_due | canceled`, `current_period_start`, `current_period_end`, `confirmed_by_admin_id`).
  - [ ] Rejects merchant registration missing website URL, CCP details, or category (`400`) — Instagram-only without website explicitly rejected.
  - [ ] Admin endpoints toggle manual verification status (`verified` / `unverified`) and confirm/manage monthly B2B subscription renewals (`active` / `past_due` / `canceled`) with audit logs (`403` for non-admins); B2B subscriptions **never** subtract from `merchant_payable_balance` or alter Section 5.6 customer-funds totals (`H_confirmed`).
  - [ ] `GET /api/merchant/balance` and `GET /api/merchant/transactions` return only the authenticated merchant's payable balance, verification status, current subscription status/renewal banner cues, gross/`2%` fee/net history, and CCP payouts.
- **Out of scope:** Instagram-only merchants & DM payment links (`Future`); hosted checkout session APIs (Task 28); numeric unverified limit enforcement (Task 8 / `O-07`).
- **Dependencies:** Task 19, Task 21.
- **Relevant existing implementation or files:** `src/db/schema.js`, `src/routes/auth.js`, `src/routes/merchant.js`, `src/routes/admin.js`, `src/services/wallet.js`.
- **Constraints:** Forward-only migrations; validate external website URLs strictly against `http:`/`https:` (no `javascript:` XSS vectors); keep `merchant_subscriptions` strictly isolated from `wallets` (`CHECK >= 0`).
- **Documentation & diagrams to update:** `docs/01-system-architecture.md`, `docs/02-data-model-and-ledger.md` (ERD `merchant_profiles`, `merchant_subscriptions`), `docs/04-security-auth-and-rbac.md`.
- **Testing expectations:** Real-DB tests for required website/CCP validation, rejection of Instagram-only/invalid URLs, admin-only verification & subscription confirmation (`403` non-admin), `past_due` subscription preserving `merchant_payable_balance` untouched, merchant history isolation, and full `npm test` pass.
- **Open owner decisions:** `None` for onboarding/verification/subscription (`O-06b` resolved: `Confirmed` two-stream separation, `Delegated` `2,000 DZD/month` configurable default; exact unverified transaction caps in Task 8 depend on `Open O-07`).

#### Task 28: Merchant API Credentials, Active-Subscription Checkout Gate & Hosted Payment Page Backend
- **Status:** `Ready for Grooming / Active Blendinar v1` *(depends on Task 12 / Task 27)*
- **Goal:** Issue revocable merchant API keys + hashed secrets, expose a server-to-server checkout session creation endpoint (`POST /api/merchant/checkout-sessions`) gated on `merchant_subscriptions.status === 'active'` (`403 Merchant subscription required` when `past_due` or `canceled`, `O-06b`) with validated `return_url` / `cancel_url`, and provide the customer Hosted Checkout inspection endpoint returning merchant identity, website domain, verification badge, gross DZD, and `0 DZD` customer fee.
- **In plain words:** Gives an external website a secure key so when a shopper clicks "Pay with Blendinar" (and the merchant's monthly subscription is active), Blendinar generates a safe 5-minute hosted checkout link showing the store name, website, and verification badge clearly — while blocking new checkouts with `403` if the store's subscription is past due without ever touching its already-earned payout balance.
- **Product plan rules & requirements:** `_docs/plan.md` `R6-B`, `R9-B`, `R12-B`, Scenario `6`, Check `22`–`23`, `O-06b`.
- **User scenarios:**
  - *Happy path (Scenario 6):* Active-subscription Merchant `"Sahara Crafts"` sends authenticated API request (`5,000 DZD`, `orderRef: "ORD-99"`, valid `https://saharacrafts.dz/return`) -> receives checkout `sessionId` and hosted checkout URL. Customer Lina opens the session (`GET /api/customer/checkout/:sessionId`) -> sees `businessName: "Sahara Crafts"`, `websiteDomain: "saharacrafts.dz"`, `verificationStatus: "verified"`, `amountDinars: 5000`, `customerFeeDinars: 0`, and simulated-money flag.
  - *Failure:* Merchant with `past_due` or `canceled` subscription calling `POST /api/merchant/checkout-sessions` -> rejected **`403 Merchant subscription required`** (existing `merchant_payable_balance` and already-created sessions remain unaffected). Invalid/revoked merchant API secret -> `401`. Unverified/malicious redirect URL (`javascript:alert(1)` or unapproved domain) -> `400`. Expired session (`> 5` mins) or already-paid session -> `400`. Suspended merchant -> `403`.
- **Acceptance criteria:**
  - [ ] Merchant API secret is generated with `crypto.randomBytes`, returned **once** at creation/rotation, and stored hashed in PostgreSQL (never plaintext).
  - [ ] `POST /api/merchant/checkout-sessions` checks live `merchant_subscriptions.status === 'active'` (`403 Merchant subscription required` if `past_due` or `canceled`), validates integer DZD amount (`> 0`, `<= Math.floor(Number.MAX_SAFE_INTEGER / 100)`), active non-suspended merchant, valid `http`/`https` callback URLs matching safe origin rules, and creates a 5-minute `pending` checkout session.
  - [ ] Hosted checkout inspection endpoint (`GET /api/customer/checkout/:sessionId`) lazily expires stale sessions (`> expires_at`), returns merchant name, domain, `verificationStatus` badge state, gross DZD, and `customerFeeDinars: 0`, and rejects already-completed/expired sessions (`400`).
  - [ ] Legacy Cohort v0 6-char payment codes are cleanly replaced on `next-product` per `O-12 (Confirmed)`.
- **Out of scope:** Payment confirmation & Stream 2 `2%` fee deduction (Task 29); DM payment links (`Future`).
- **Dependencies:** Task 12 / Task 27, Task 16, Task 21.
- **Relevant existing implementation or files:** `src/db/schema.js`, `src/services/payment.js`, `src/routes/merchant.js`, `src/routes/customer.js`.
- **Constraints:** Hash API secrets at rest; block open redirects and XSS URL schemes; forward-only migrations.
- **Documentation & diagrams to update:** `docs/01-system-architecture.md` (checkout session endpoints), `docs/02-data-model-and-ledger.md` (`checkout_sessions` / `merchant_api_keys` / `merchant_subscriptions`), `docs/04-security-auth-and-rbac.md` (API key auth).
- **Testing expectations:** Real-DB tests for `past_due`/`canceled` subscription `403 Merchant subscription required` block, key issuance/rotation/revocation (`401`), invalid/XSS return URL rejection (`400`), suspended merchant block (`403`), lazy 5-min expiry, and full `npm test` pass.
- **Open owner decisions:** `None` (unverified caps enforced in Task 8).

---

### Milestone 6 — Customer Payment Flow & Merchant Fees `[MANDATORY MILESTONE STOP POINT]`

> **Milestone Stop Point:** Upon completing Tasks 29 & 8, **STOP and obtain Lyna's review and approval** before starting Daily Merchant CCP Payouts.

#### Task 29: Hosted Checkout Confirmation, Configurable `2%` Transaction Fee (`0` Customer Fee) & Accumulated Fees
- **Status:** `Ready for Grooming / Active Blendinar v1`
- **Goal:** Implement atomic customer password-confirmed checkout payment deducting `grossAmount` from Customer Spendable Balance (`0 DZD` customer fee), crediting `grossAmount - feeAmount` to Merchant Payable Balance using **Stream 2**'s **`2%` (`200` bps) confirmed default transaction fee** (`O-06`), and crediting `feeAmount` to Blendinar Accumulated Transaction Fees (strictly separate from **Stream 1**'s B2B subscription in Tasks 27–28), with full concurrency and scoped idempotency protections.
- **In plain words:** When a customer enters their password on Blendinar's checkout page to pay `5,000 DZD`, they pay `0 DZD` extra fee, the merchant earns `4,900 DZD` (after Blendinar's `2%` = `100 DZD` transaction fee), and Blendinar safely tracks its earned transaction fee in a separate ledger bucket—completely independent of the merchant's `2,000 DZD/month` B2B subscription—even if two people click Pay at the exact same millisecond.
- **Product plan rules & requirements:** `_docs/plan.md` `R4`, `R6-B`, `R9-B`, `R12-B`, Section `5.6`, Scenarios `6`–`7`, Checks `5`–`7`, `10`–`11`, `24`–`27`, `O-06` (`Confirmed`), `O-06b` (`Confirmed` / `Delegated`).
- **User scenarios:**
  - *Happy path (Scenario 7):* Lina has `5,000 DZD` Spendable Balance (`0` pending/locked issue) and confirms a `5,000 DZD` checkout session with her password and `Idempotency-Key: "pay-99"`. Atomically: Lina Spendable decreases `-5,000 DZD` (`0 DZD`), `2%` merchant fee (`Math.round(500000 * 200 / 10000) = 10,000` centimes = `100 DZD`), Merchant Payable increases `+4,900 DZD`, Blendinar Accumulated Transaction Fees increases `+100 DZD`, session marks `completed`, and append-only ledger records payment + `fee_amount`.
  - *Failure:* Wrong password (even with reused `Idempotency-Key`) -> `401`, `0` money moved. Customer has `0 DZD` Spendable and `5,000 DZD` Pending Top-Up -> `400 Insufficient spendable balance`. Two concurrent `Promise.all` payments of `3,000 DZD` on `5,000 DZD` balance -> exactly one `200`, one `400`, final balance `2,000 DZD`. Configuration yielding `fee >= paymentAmount` -> rejected cleanly.
- **Acceptance criteria:**
  - [ ] Defaults configurable merchant transaction fee to `2%` (`200` bps) in centralized config (`0` customer fee), computed in integer centimes as `Math.round(amountCentimes * feeBps / 10000)` (minimum `1` centime whenever `feeBps > 0`), and rejects any payment/config where `feeAmount >= grossAmount` or `feeAmount < 0`.
  - [ ] Verifies active non-suspended customer, `bcrypt.compare(password, ...)`, and payload hash **before** replaying cached `(user_id, endpoint, key)` idempotency response.
  - [ ] Locks checkout session and all involved balance/account rows via deterministic ascending `SELECT ... FOR UPDATE` inside one PostgreSQL transaction (`CHECK (balance >= 0)`).
  - [ ] Credits Merchant Payable (`gross - fee`) and Blendinar Accumulated Transaction Fees (`fee`) with immutable append-only `transactions` rows, without touching `merchant_subscriptions` B2B billing.
  - [ ] Rollback via `_testFailureAfterBalanceUpdate` leaves customer, merchant, fee, and session rows completely unchanged.
- **Out of scope:** Customer-paid fees (`Confirmed` `0` in v1); daily CCP payout settlement (Task 30); B2B monthly subscription setup/gate (Tasks 12/27 & 28); P2P transfers (`Future` per `O-11 Delegated`).
- **Dependencies:** Task 16, Task 25, Task 28.
- **Relevant existing implementation or files:** `src/services/payment.js`, `src/routes/customer.js`, `src/db/schema.js`, `tests/payment.test.js`, `tests/payment-concurrency.test.js`.
- **Constraints:** Integer centimes only; admin-configurable bps starting at `200` (`2%`); forward-only migrations.
- **Documentation & diagrams to update:** `docs/02-data-model-and-ledger.md` (fee & merchant payable ledger flow), `docs/03-concurrency-and-idempotency.md` (checkout confirmation sequence & lock order).
- **Testing expectations:** Real-DB tests for `2%` (`200` bps) gross-minus-fee math, rounding edge cases (`1 DZD` / small amounts with `>= 1` centime floor when `feeBps > 0`), `fee >= amount` rejection, simultaneous checkout session & dual-payment `Promise.all` races, wrong-password-before-idempotency-replay, `_testFailureAfterBalanceUpdate` rollback, conservation check, and full `npm test` pass.
- **Open owner decisions:** `None` (`O-06` Confirmed `2%` / `200` bps Stream 2 transaction fee and `O-06b` Confirmed/Delegated Stream 1 B2B subscription separation).

#### Task 8: Centralized & Admin-Configurable Limits Enforcement Across Customers, Unverified Merchants & Agents
- **Status:** `Blocked on Owner Decision (Open O-07)` *(aligns baseline Task 8 / Issue `#17`)*
- **Goal:** Create Blendinar's centralized limits configuration module (admin-configurable in DB/config) enforcing `O-04 Delegated` customer (`50k`/`100k`/`200k` DZD) and agent exposure (`50k`/`250k` DZD) limits alongside stricter `Unverified Merchant` payment limits (`Open O-07`) consistently across services.
- **In plain words:** Puts all platform safety caps—customer spend/balance limits, stricter limits on unverified online stores, fixed cash top-up amounts, and agent cash caps—in one controlled place instead of scattered numbers.
- **Product plan rules & requirements:** `_docs/plan.md` `R5`, `R5-B`, `R9-B`, Check `8`, `18`, `22`, `O-04` (`Delegated`), `Open O-07`.
- **User scenarios:**
  - *Happy path:* Customer attempts `10,000 DZD` payment at a `Verified Merchant` within `50,000 DZD`/tx and `100,000 DZD`/day limits -> succeeds. An Admin updates unverified merchant per-payment cap -> immediately enforced on subsequent checkout creation/confirmation.
  - *Failure:* Customer attempts payment exceeding `50,000 DZD`/tx or `100,000 DZD`/day (`O-04`), or checkout at an `Unverified Merchant` exceeding unverified cap (`O-07`) -> rejected `400` with explicit limit message and zero balance change.
- **Acceptance criteria:**
  - [ ] Centralized configuration module/table holds: fixed top-up presets `[1k, 2k, 5k, 10k, 20k]` DZD, customer limits (`50,000 DZD`/tx, `100,000 DZD`/day, `200,000 DZD` max balance), verified vs. unverified merchant limits (`O-07`), and `50,000 DZD` Individual vs. `250,000 DZD` Fixed-Office agent cash exposure limits.
  - [ ] Every top-up (`Spendable + Pending + NewTopUp <= 200,000`), hand-in confirmation, checkout creation, and payment confirmation checks active limits inside the locked transaction so concurrent requests cannot race past daily or max-balance caps.
  - [ ] Only `admin` can view/update centralized limits (`403` for all other roles); invalid (`<= 0`, non-integer, overflow) config updates rejected `400`.
- **Out of scope:** Per-customer bespoke limit tiers (`Future`).
- **Dependencies:** Task 24, Task 25, Task 29, Lyna decision on `O-07`.
- **Relevant existing implementation or files:** New `src/config/limits.js` / `src/services/config.js`, `src/services/topup.js`, `src/services/payment.js`, `src/routes/admin.js`.
- **Constraints:** Never hardcode unapproved `O-07` values as `Confirmed`; enforce limits inside `FOR UPDATE` transactions to prevent daily-limit races.
- **Documentation & diagrams to update:** `docs/01-system-architecture.md`, `docs/05-design-patterns-and-adrs.md` (centralized config ADR/pattern).
- **Testing expectations:** Real-DB boundary tests (`limit`, `limit + 1`), concurrent daily-limit race (`Promise.all` two transactions each under daily limit whose sum exceeds daily limit -> exactly one succeeds), unverified vs. verified merchant cap tests, and full `npm test` pass.
- **Open owner decisions:** **`O-07`** (Unverified vs. Verified merchant transaction caps — `O-04` customer & agent caps already resolved via `Delegated`).

---

### Milestone 7 — Daily Merchant CCP Payouts `[MANDATORY MILESTONE STOP POINT]`

> **Milestone Stop Point:** Upon completing Task 30, **STOP and obtain Lyna's review and approval** before starting Customer Refunds.

#### Task 30: Daily Merchant CCP Payout Batch Preparation, Admin Simulated Settlement & Exception States
- **Status:** `Blocked on Owner Decision (Open O-08)`
- **Goal:** Implement daily CCP payout batch preparation per eligible merchant (`gross - fees` payable balance + registered CCP details), Admin simulated payout settlement confirmation, merchant payout history, and explicit handling of `prepared`, `settled`, `failed`, `reversed`, `disputed`, and `delayed` payout states — ensuring already-earned Merchant Payable Balances still settle normally even if a merchant's separate B2B subscription (`O-06b`) is `past_due`.
- **In plain words:** At the end of each day, Blendinar groups each merchant's unpaid earnings and CCP account info into a daily payout list; an Admin reviews and confirms the simulated CCP transfer so the merchant's unpaid balance resets to `0 DZD` and payout history shows it settled (even if the merchant's monthly B2B subscription later went past due—Blendinar never confiscates already-earned merchant payouts).
- **Product plan rules & requirements:** `_docs/plan.md` `R6-B`, `R13`, Section `5.6`, Scenario `8`, Checks `28`–`29`, `O-06b` (`Confirmed` payable isolation), `O-08` (`Open`).
- **User scenarios:**
  - *Happy path (Scenario 8):* Merchant completes `5,000 + 2,000 + 3,000 = 10,000 DZD` gross sales (`200 DZD` at the `2%` confirmed default fee -> `9,800 DZD` Merchant Payable Balance). Daily payout preparation creates batch item (`status: prepared`, `netAmount: 9,800 DZD`, CCP account details). Admin confirms simulated CCP transfer -> batch item transitions `prepared -> settled`, Merchant Payable drops `9,800 -> 0 DZD`, `P_settled` rises `+9,800 DZD`, and Merchant views `9,800 DZD settled` in payout history. Even if `merchant_subscriptions` becomes `past_due`, this `9,800 DZD` settles normally.
  - *Failure / Concurrency:* Two concurrent `Promise.all` batch-preparation or Admin settlement calls for the same cutoff window -> settled **at most once**, never negative or double-paid. Zero-balance or below-threshold (`O-08`) merchant excluded. Marking a prepared/attempted payout `failed`, `delayed`, or `disputed` preserves accurate Merchant Payable Balance without silent money loss.
- **Acceptance criteria:**
  - [ ] Forward-only migration creates `merchant_payout_batches` / `merchant_payouts` tables storing cutoff key (preventing duplicate batch generation per merchant+cutoff), `gross_amount`, `fee_amount`, `net_amount` (`bigint` centimes), snapshot of CCP account details, and state (`prepared`, `settled`, `failed`, `reversed`, `disputed`, `delayed`).
  - [ ] Preparation and Admin settlement execute inside `SELECT ... FOR UPDATE` transactions locking merchant payable row + payout row in ascending ID order, settling earned payables regardless of separate `merchant_subscriptions` status (`O-06b`).
  - [ ] Admin confirmation of `settled` atomically debits Merchant Payable Balance (`CHECK >= 0`), increments `P_settled`, and appends immutable ledger transaction; `_testFailureAfterBalanceUpdate` rolls back cleanly.
  - [ ] Exception transitions (`failed`, `reversed`, `disputed`, `delayed`) follow explicit state-machine rules without losing payable funds or editing past ledger rows.
- **Out of scope:** Real Algérie Poste CCP / BaridiMob / bank API calls (`Future`); B2B subscription fees (`merchant_subscriptions` sits outside customer conservation in Tasks 12/27–28).
- **Dependencies:** Task 29, Lyna decision on `O-08`.
- **Relevant existing implementation or files:** `src/db/schema.js`, `src/routes/admin.js`, `src/routes/merchant.js`, new `src/services/payout.js`.
- **Constraints:** Forward-only migrations; integer centimes; simulated CCP notice retained; `admin`-only settlement (`403` for merchant/agent/customer); never deduct B2B subscription charges from `merchant_payable_balance` or violate `CHECK >= 0`.
- **Documentation & diagrams to update:** `docs/01-system-architecture.md`, `docs/02-data-model-and-ledger.md` (payout ERD), `docs/03-concurrency-and-idempotency.md` (payout state machine & cutoff lock).
- **Testing expectations:** Real-DB tests for Scenario 8 (`10,000` gross / `9,800` net settlement), daily payout still settling earned balance when `merchant_subscriptions.status === 'past_due'`, concurrent cutoff double-run & double-settlement `Promise.all` races, exception states (`failed`/`reversed`/`disputed`/`delayed`), `_testFailureAfterBalanceUpdate` rollback, two-part conservation assertion, and full `npm test` pass.
- **Open owner decisions:** **`O-08`** (Daily cutoff hour/timezone, minimum payout threshold, auto-schedule vs. Admin-triggered preparation; `O-06b` resolved).

---

### Milestone 8 — Customer Refunds of Unused Balance `[MANDATORY MILESTONE STOP POINT]`

> **Milestone Stop Point:** Upon completing Tasks 31–32, **STOP and obtain Lyna's review and approval** before starting Milestone 9 portals and final audit.

#### Task 31: Pre-Departure Customer Cash Refund Request (`0` Fee), Balance Lock, Self-Cancel & 72h Auto-Expiry (`O-09`, `O-10`)
- **Status:** `Ready for Grooming / Active Blendinar v1`
- **Goal:** Allow an active email-verified customer to request a cash refund (`0 DZD` fee) of unused Spendable Balance at a selected Fixed-Location Office before departing Algeria—**immediately and atomically locking** funds from Spendable Balance into **Locked Refund Balance**, routing walk-in requests `<= 20,000 DZD` (when petty float suffices) vs. **`scheduled_next_day_pickup`** (`> 20,000 DZD` or insufficient float per `O-09 Confirmed`), allowing self-cancellation prior to payout, emitting a **pre-72h expiry reminder**, and enforcing **72-hour auto-expiry** (`O-10 Confirmed`), safe against simultaneous checkout spending.
- **In plain words:** When a tourist wants to cash out leftover Dinars before flying home, Blendinar immediately locks that money so they cannot double-spend it online, tells them clearly whether it qualifies for walk-in cash pickup (`<= 20,000 DZD`) or next-day office pickup (`> 20,000 DZD`), reminds them before the 72-hour window expires, and unlocks funds cleanly if cancelled or expired.
- **Product plan rules & requirements:** `_docs/plan.md` `R14`, Section `5.6`, Section `6.8` & `6.10`, Scenario `9` part 1, Check `30`–`31`, `O-09` (`Confirmed`), `O-10` (`Confirmed`).
- **User scenarios:**
  - *Happy path (Scenario 9 part 1):* Customer Tariq has `3,000 DZD` Spendable Balance and requests a `3,000 DZD` cash refund (`0 DZD` fee) at a Fixed-Location Office with sufficient petty float. Atomically: Spendable Balance drops `3,000 -> 0 DZD`, `Locked Refund Balance` rises `0 -> 3,000 DZD`, and a refund record (`status: locked_refund`, `cash_source_type: office_petty_float`, `expiresAt = now + 72h`) is created. If Tariq requests `35,000 DZD` (`> 20,000 DZD`), status becomes `scheduled_next_day_pickup` and queues a scheduled notification. If Tariq self-cancels before payout (or 72 hours elapse after a pre-expiry reminder), funds unlock cleanly back to Spendable Balance.
  - *Failure / Concurrency:* Tariq has `3,000 DZD` Spendable and simultaneously submits (`Promise.all`) a `3,000 DZD` merchant checkout payment and a `3,000 DZD` refund request -> **exactly one succeeds** (`200`/`201`) and the other fails (`400 Insufficient spendable balance`). Attempting to refund Pending Top-Ups (`5,000 DZD` pending, `0 DZD` spendable) or requesting/cancelling from a suspended account -> rejected `400`/`403`.
- **Acceptance criteria:**
  - [ ] Forward-only migration creates `refund_requests` table (`customer_id`, `office_id`, `amount` centimes `CHECK (amount > 0)`, `pickup_code`, `cash_source_type` = `office_petty_float | admin_scheduled_funding`, `status` = `locked_refund | scheduled_next_day_pickup | ready_for_pickup | paid | cancelled | expired | disputed`, `expires_at` = `+72h`, timestamps) and tracks `locked_refund_balance` (`CHECK >= 0`).
  - [ ] Refund request enforces integer whole-dinar validation (`> 0`, `<= Math.floor(Number.MAX_SAFE_INTEGER / 100)`), active non-suspended customer, and scoped idempotency `(user_id, endpoint, key)`.
  - [ ] Inside `SELECT ... FOR UPDATE` transaction, deducts from `spendable_balance`, adds to `locked_refund_balance`, classifies `<= 20,000 DZD` with available Fixed-Office petty float as `locked_refund` vs. `> 20,000 DZD` or insufficient float as `scheduled_next_day_pickup` (`O-09 Confirmed`), and records append-only ledger/lock entry (`0` customer fee).
  - [ ] Customer self-cancellation endpoint and lazy/sweep **72-hour auto-expiry** atomically unlock `locked_refund` / `scheduled_next_day_pickup` / `ready_for_pickup` back to `spendable_balance` (`O-10 Confirmed`), and emit pre-72h expiry reminder notifications (`Section 6.10`).
  - [ ] Payment-vs-refund `Promise.all` race and `_testFailureAfterBalanceUpdate` rollback pass cleanly; Part 1 conservation holds ($C_{\text{spend}} + C_{\text{locked}}$ unchanged).
- **Out of scope:** FX / international bank transfers (`Future`); Agent cash disbursement & Admin petty-float/next-day batch funding (Task 32); Admin erroneous-transaction reversals (Task 11 `Future`).
- **Dependencies:** Task 21, Task 22 (Fixed-Location Offices), Task 25, Task 29.
- **Relevant existing implementation or files:** `src/db/schema.js`, `src/routes/customer.js`, `src/services/payment.js`, new `src/services/refund.js`.
- **Constraints:** Forward-only migrations; `CHECK (locked_refund_balance >= 0)`; zero customer refund fees in v1.
- **Documentation & diagrams to update:** `docs/01-system-architecture.md`, `docs/02-data-model-and-ledger.md` (`refund_requests`, `locked_refund_balance`), `docs/03-concurrency-and-idempotency.md` (payment-vs-refund lock race).
- **Testing expectations:** Real-DB tests for atomic lock (`<= 20,000 DZD` petty-float eligible vs `> 20,000 DZD` `scheduled_next_day_pickup`), self-cancellation, 72h auto-expiry + pre-72h reminder emission, pending-balance rejection, `Promise.all` payment-vs-refund race, suspension `403`, `_testFailureAfterBalanceUpdate` rollback, and full `npm test` pass.
- **Open owner decisions:** `None` (`O-09` Confirmed Hybrid Option 4 and `O-10` Confirmed: self-cancel + 72-hour auto-expiry).

#### Task 32: Agent Passport Check, Cash Refund Disbursement, Cancel-vs-Payout Race & Hybrid Office Petty-Float / Next-Day Reconciliation (`O-09`)
- **Status:** `Ready for Grooming / Active Blendinar v1`
- **Goal:** Enable Fixed-Location Offices and Admin to fulfill physical cash refunds under **Confirmed `O-09` Option 4 (Hybrid)**: maintain Admin-funded Fixed-Office petty-cash refund floats for instant walk-in payouts `<= 20,000 DZD`, let Admin fund next-day pickups (`scheduled_next_day_pickup -> ready_for_pickup`, notifying customer **`ready_for_pickup` at `[Fixed Office]`**), and let authorized Agents inspect a customer's passport and active (`< 72h`) refund request, pay cash (`status: paid`), clear `Locked Refund Balance`, and block cancel-vs-payout races.
- **In plain words:** Completes the cash-out step reliably under Option B: smaller refunds (`<= 20,000 DZD`) are paid immediately from Fixed Offices' Admin-funded petty float, larger refunds or low-float requests are funded overnight by Admin so the tourist gets an alert when cash is ready at the office, and row locks prevent double-payout, expired-payout, or cancellation races.
- **Product plan rules & requirements:** `_docs/plan.md` `R14`, Section `5.6`, Section `6.8` & `6.10`, Scenario `9` part 2, Check `31`, `O-09` (`Confirmed` Option 4 Hybrid), `O-10` (`Confirmed`).
- **User scenarios:**
  - *Happy path (Scenario 9 part 2):* (a) Tariq visits a Fixed-Location Office within 72h with passport and refund code for `3,000 DZD` (`locked_refund`, petty float `>= 3,000 DZD`). Agent verifies passport + record and marks refund `paid` -> `Locked Refund Balance` drops `3,000 -> 0 DZD`, `R_paid` increases `+3,000 DZD`, Fixed-Office `refund_petty_float_balance` decreases `-3,000 DZD`, and Part 1 conservation holds. (b) For a `35,000 DZD` (`scheduled_next_day_pickup`) refund, Admin marks the pickup funded -> transitions to `ready_for_pickup` and notifies Tariq (`"Ready for pickup at [Fixed Office]"`), after which Agent verifies passport + code and marks `paid`.
  - *Failure / Concurrency:* Customer simultaneously cancels the refund while Agent marks it `paid` (`Promise.all`) -> row lock allows **exactly one** outcome (`paid` OR `cancelled` back to spendable), never both. Refund past 72h auto-expiry or still `scheduled_next_day_pickup` (not yet `ready_for_pickup`) -> rejected `400`. Insufficient Fixed-Office petty float -> rejected cleanly without going negative (`CHECK >= 0`). Two agents simultaneously mark the same refund `paid` -> at most one succeeds (`200`), second fails (`400`/`409`). Customer or merchant calls payout endpoint -> `403`.
- **Acceptance criteria:**
  - [ ] Admin endpoint funds/replenishes Fixed-Location Office `refund_petty_float_balance` (`CHECK >= 0`) and transitions funded `scheduled_next_day_pickup` items to `ready_for_pickup`, emitting the customer **`ready_for_pickup` at `[Fixed Office]`** notification (`O-09 Confirmed` / Section 6.10).
  - [ ] Only active `agent` (or `admin` if configured) can mark an unexpired (`< 72h`) `locked_refund` (with sufficient office petty float) or `ready_for_pickup` request `paid` (`403` for `customer`/`merchant`; `400` if expired `> 72h` or un-funded `scheduled_next_day_pickup`).
  - [ ] Atomically locks refund row + customer wallet + Fixed-Office petty-float / funded batch row with deterministic `SELECT ... FOR UPDATE` ordering (`CHECK >= 0`).
  - [ ] Clears `locked_refund_balance`, increments `R_paid`, records append-only refund payout transaction, and tracks Fixed-Office petty float or Admin-funded next-day payout custody accurately.
  - [ ] Routes disputed cash-payout claims to Admin review without auto-banning or deleting ledger history (`O-10 Confirmed`).
- **Out of scope:** International wire/FX refunds (`Future`); Agent commissions (`Confirmed` excluded).
- **Dependencies:** Task 20, Task 22, Task 31.
- **Relevant existing implementation or files:** `src/services/refund.js`, `src/routes/agent.js`, `src/routes/admin.js`, `src/routes/customer.js`, `src/db/schema.js`.
- **Constraints:** Forward-only migrations; integer centimes; `refund_petty_float_balance >= 0`; never edit existing ledger rows.
- **Documentation & diagrams to update:** `docs/01-system-architecture.md`, `docs/02-data-model-and-ledger.md`, `docs/03-concurrency-and-idempotency.md` (cancel-vs-payout race & Option 4 hybrid cash-source accounting).
- **Testing expectations:** Real-DB tests for Scenario 9 walk-in petty-float payout (`<= 20,000 DZD`), next-day `scheduled_next_day_pickup -> ready_for_pickup -> paid` + notification emission, petty-float depletion rejection (`>= 0` guard), `> 72h` expiry block, double-payout `Promise.all` race, cancel-vs-payout `Promise.all` race, `_testFailureAfterBalanceUpdate` rollback, two-part conservation assertion, and full `npm test` pass.
- **Open owner decisions:** `None` (`O-09` Confirmed Option 4 Hybrid and `O-10` Confirmed).

---

### Milestone 9 — Administration, Portals, Demonstration Merchant & Verification `[MANDATORY MILESTONE STOP POINTS PER FRONTEND AREA]`

#### Task 33: Administrator Config Management, Risk Review Queue & Two-Part Conservation Audit Endpoint
- **Status:** `Blocked on Owner Decision (Proposed Section 5.6 Approval)` *(depends on Milestones 1–8 & Section 5.6 approval)*
- **Goal:** Build comprehensive Admin backend APIs for updating centralized limits/presets/merchant fees, reviewing informational risk/shortage flags, searching platform-wide append-only ledgers, and computing real-time **Two-Part Financial Conservation** diagnostics.
- **In plain words:** Gives the platform Admin a single secure backend control center to manage limits and merchant fees, investigate flagged cash shortages, inspect every movement of money, and prove mathematically at any time that all Dinars and collected cash add up to the exact centime.
- **Product plan rules & requirements:** `_docs/plan.md` `R5-B`, `R6-B`, `R11`, Section `5.6`, Section `6.9`, Checks `14`, `33`, `34`.
- **User scenarios:**
  - *Happy path:* Admin calls `GET /api/admin/conservation` -> server queries integer-centime sums directly from PostgreSQL and returns `digitalConserved: true` ($C_{\text{spend}} + C_{\text{locked}} + M_{\text{payable}} + F_{\text{acc}} + R_{\text{paid}} + P_{\text{settled}} === H_{\text{confirmed}}$) and `cashCustodyConserved: true` ($A_{\text{collected\_valid}} === T_{\text{pending}} + H_{\text{confirmed}}$). Admin updates merchant fee config with audit trail -> applies to subsequent checkouts only (never mutating past transactions).
  - *Failure:* Customer, agent, or merchant calling `/api/admin/*` -> `403`. Admin attempting to set fee `>=` minimum allowed payment or negative limit -> `400`.
- **Acceptance criteria:**
  - [ ] Admin-only config endpoints validate and persist limits/presets/fee config with an immutable config-change audit log (past transactions remain untouched).
  - [ ] `GET /api/admin/conservation` computes Part 1, Part 2, and Unified Reconciliation Identity strictly in integer centimes (`bigint`).
  - [ ] Admin audit/flag endpoints surface informational shortage/overdue flags and full filterable ledger history (`403` for non-admins).
- **Out of scope:** Financial CSV/BI report builders (`Proposed` excluded from v1); AI anomaly detection (`Dropped`).
- **Dependencies:** Tasks 16–32, Lyna approval of Section 5.6 conservation model.
- **Relevant existing implementation or files:** `src/routes/admin.js`, `src/services/config.js`, `src/services/wallet.js`, `src/services/topup.js`, `src/services/payout.js`, `src/services/refund.js`.
- **Constraints:** Append-only ledger strictly preserved; integer centimes only; `admin` role enforced via `requireRole('admin')`.
- **Documentation & diagrams to update:** `docs/01-system-architecture.md`, `docs/02-data-model-and-ledger.md`.
- **Testing expectations:** Real-DB tests for fee/limit config updates affecting only future transactions, invalid config `400`, `403` RBAC across non-admin roles, conservation audit accuracy after mixed operations, and full `npm test` pass.
- **Open owner decisions:** `Proposed Section 5.6 Two-Part Financial Conservation Invariant awaiting Lyna's approval (plus resolved O-04..O-08 from earlier milestones).`

#### Task 34: End-to-End Blendinar Two-Part Conservation & 50-Request Concurrency Stress Test Suite
- **Status:** `Ready for Grooming / Active Blendinar v1` *(completes remaining stress/conservation scope of baseline Task 9)*
- **Goal:** Build a dedicated real-PostgreSQL automated stress and invariant test suite running ~50 simultaneous requests across top-up hand-ins, checkout payments with fees, daily CCP payouts, and customer refund locks/payouts, proving zero deadlocks and exact Two-Part Financial Conservation.
- **In plain words:** Hammers the whole Blendinar backend with 50 simultaneous requests at once (payments, refunds, top-ups, payouts happening together) and proves PostgreSQL never deadlocks, never goes negative, and never loses or invents a single centime.
- **Product plan rules & requirements:** `_docs/plan.md` `R12-B`, Section `5.6`, Check `34`; `_docs/testing-guidelines.md` Sections `4`, `7`.
- **User scenarios:**
  - *Happy path:* Test seeds multiple customers, agents, merchants, and confirmed top-ups (e.g., `500,000 DZD` total), launches 50 concurrent `Promise.all` mixed operations (valid & over-balance payments, refund locks, hand-ins, repeated idempotency keys, suspended accounts), verifies zero `500` deadlock/DB errors, zero negative balances, and exact Part 1 + Part 2 conservation equality in centimes.
  - *Failure:* Any lock-ordering bug, lost update, or fee-rounding drift fails the invariant assertion loudly.
- **Acceptance criteria:**
  - [ ] Automated test file executes >= 50 simultaneous `Promise.all` requests against real PostgreSQL with zero `500` deadlock failures.
  - [ ] Verifies deterministic ascending lock order prevents deadlocks across multi-party concurrent transactions.
  - [ ] Queries raw PostgreSQL tables after all concurrent waves finish and asserts exact centime equality for Part 1 ($C_{\text{spend}} + C_{\text{locked}} + M_{\text{payable}} + F_{\text{acc}} + R_{\text{paid}} + P_{\text{settled}} = H_{\text{confirmed}}$), Part 2 ($A_{\text{collected\_valid}} = T_{\text{pending}} + H_{\text{confirmed}}$), and `balance >= 0` across all accounts.
- **Out of scope:** External load-testing SaaS tooling (kept within `npm test` Vitest suite).
- **Dependencies:** Tasks 16–33.
- **Relevant existing implementation or files:** `tests/payment-concurrency.test.js`, new `tests/blendinar-stress-conservation.test.js`.
- **Constraints:** Test-only task (do not alter production semantics or relax existing assertions); `--no-file-parallelism` preserved.
- **Documentation & diagrams to update:** `docs/06-devops-testing-and-workflow.md` (updated test count & stress suite summary).
- **Testing expectations:** `npm test` executes the 50-request stress & conservation suite alongside all existing tests with 0 failures.
- **Open owner decisions:** `Requires Lyna approval of Proposed Section 5.6 Two-Part Financial Conservation Invariant (inherited via Task 33 & Milestones 4–8).`

#### Task 13: React Frontend — Customer Portal, Agent Directory, 3-State Wallet, Refunds & Hosted Checkout
- **Status:** `Ready for Grooming / Active Blendinar v1` *(aligns baseline Task 13 / Issue `#18`; **MANDATORY STOP POINT per major frontend area**)*
- **Goal:** Build the React 19 + Tailwind CSS 4 Customer Portal and Blendinar Hosted Payment Page strictly matching [`_docs/design-system.md`](./design-system.md) and agreed backend APIs, including persistent contextual banners, in-app bell/feed notifications & reminders (`_docs/plan.md` Section 6.10), confirmation modals, and Blendinar's zero-tracking-cookie essential-only policy.
- **In plain words:** Replaces the starter card with clean, mobile-friendly screens where tourists sign up by email, pre-scan passport MRZ for Agent counter confirmation, find agents, verify an agent in-app, clearly see Spendable vs. Pending (*Not yet spendable*) vs. Locked-for-Refund balances, pay external websites on Hosted Checkout (`0 DZD` fee), and manage pre-departure cash refunds with clear pickup/expiry reminders and zero intrusive tracking cookie pop-ups.
- **Product plan rules & requirements:** `_docs/plan.md` `R7-B`, `R7-C`, `R8-B`, `R9-B`, `R14`, `R15`, Section `6.10`; `_docs/design-system.md` all sections (including Sections 3 & 5).
- **User scenarios:**
  - *Happy path:* Tourist opens Hosted Checkout for `5,000 DZD` at `"Sahara Crafts"`, confirms via the Hosted Checkout Payment Modal showing simulated-money banner, `Verified Merchant` badge, `saharacrafts.dz`, `0 DZD customer fee`, and password confirmation -> returns cleanly to `return_url`. On Customer Dashboard, sees three separate cards (`Spendable`, `Pending Top-Ups`, `Locked for Refund`), KYC progress banner (`prechecked_pending_agent` -> `passport_verified`), persistent Pre-Departure Refund Planning Banner (`<= 20,000 DZD` walk-in petty float vs `> 20,000 DZD` next-day pickup, >= 24h warning), in-app notification bell (top-ups, `ready_for_pickup at [Fixed Office]`, pre-72h expiry reminder), and essential-only footer note with zero tracking cookie pop-ups.
  - *Failure:* Suspended customer sees Read-Only Suspended Account Banner with balances/history intact and blocked mutation alerts (`role="alert"`); insufficient spendable balance explains why pending top-ups cannot be spent; browser never submits invalid/negative amounts or bypasses server validation.
- **Acceptance criteria:**
  - [ ] Persistent contextual banners: global simulated-money notice, **Pre-Departure Refund Planning Banner (`O-09 Confirmed`)**, **2-step Passport KYC Banner (`O-02 Confirmed`)**, and Read-Only Suspended Account Banner (`O-03 Confirmed`).
  - [ ] Three distinct customer balance cards (**Spendable**, **Pending Top-Ups — Not yet spendable**, **Locked for Refund**) are **never** merged into a single balance figure.
  - [ ] Agent & Office Directory displays locations, hours, and external contacts; in-app Agent Verification displays registered name, role type, verification code, and anti-screenshot warning.
  - [ ] Hosted Checkout displays merchant name, website domain, manual verification badge (`Verified Merchant` vs. `Unverified Merchant — lower transaction limits apply`), gross DZD, `0 DZD` customer fee, and confirmation modal with live password input.
  - [ ] **Customer Portal & Notification Flows:** Includes email + optional-phone backup recovery flow (`O-01`), Step 1 in-app ICAO MRZ pre-scan & Step 2 status tracking (`O-02`), Refund Request Lock confirmation modal classifying `<= 20,000 DZD` petty-float vs `scheduled_next_day_pickup` + self-cancel (`O-09`, `O-10`), in-app Notification Bell/Feed (top-up, KYC, checkout, **`ready_for_pickup` at `[Fixed Office]`**, **48h/24h pre-72h expiry reminders**), and all semantic badges (`_docs/design-system.md` Section 3).
  - [ ] **Essential-Only Storage & Footer (`Section 6.10` / `design-system.md` 5D):** Zero third-party ads/analytics/tracking cookies (no cookie-consent pop-up) with lightweight footer disclosure.
  - [ ] Keyboard accessible (`focus-visible`, semantic forms/buttons, `aria-live` errors), whole-DZD display from API values, English-first with RTL-ready logical utilities, and `npm run build` succeeds cleanly.
- **Out of scope:** Agent, Merchant & Admin portals (Task 14); Arabic/French translation strings (`Future`); browser-computed authoritative fees/balances (forbidden).
- **Dependencies:** Backend APIs (Milestones 1–8) & Lyna's approval at each prior stop point.
- **Relevant existing implementation or files:** `src/client/App.jsx`, `src/client/index.css`, `src/client/main.jsx`, `index.html`, `_docs/design-system.md`.
- **Constraints:** Follow `_docs/design-system.md` strictly; use React 19 + Tailwind CSS 4 already in `package.json` (no unauthorized UI libraries); never invent backend rules in browser.
- **Documentation & diagrams to update:** `docs/01-system-architecture.md` (frontend routes/views overview), `docs/06-devops-testing-and-workflow.md`.
- **Testing expectations:** Verify `npm run build`, frontend component/flow checks (if added) and full backend `npm test` pass, plus manual/Playwright walkthrough across Customer & Hosted Checkout portals before Milestone Stop Point sign-off.
- **Open owner decisions:** `None` (all API contracts finalized before Milestone 9).

#### Task 14: React Frontend — Agent Portal, Merchant Portal & Administrator Operational Dashboard
- **Status:** `Ready for Grooming / Active Blendinar v1` *(aligns baseline Task 14 / Issue `#19`; **MANDATORY STOP POINT per major frontend area**)*
- **Goal:** Build the React 19 + Tailwind CSS 4 portals for employee **Agents**, external **Merchants**, and **Administrators** strictly matching [`_docs/design-system.md`](./design-system.md) (Sections 3 & 5) and `_docs/plan.md` Section 6.10.
- **In plain words:** Gives Blendinar Agents screens to verify passports via side-by-side Approve/Reject modals (`O-02` — zero manual typing), record fixed-preset cash top-ups, monitor `80%` exposure cap warnings, and fulfill walk-in or next-day refunds (`O-09`); gives Merchants screens for API keys, sales/fee history, and daily CCP payouts; and gives Admins full controls, notification queue badges, confirmation modals, and conservation inspection.
- **Product plan rules & requirements:** `_docs/plan.md` Sections `3`, `6.3`–`6.10`; `_docs/design-system.md` all sections (including Sections 3 & 5).
- **User scenarios:**
  - *Happy path:* Agent logs in -> sees `prechecked_pending_agent` customer passport summary side-by-side, clicks **Approve** (`O-02`), records `5,000 DZD` preset top-up via confirmation modal, watches exposure meter (`80%` warning banner when near limit), submits hand-in batch, and fulfills `locked_refund` / `ready_for_pickup` refunds. Admin logs in -> confirms hand-in via confirmation modal, funds Fixed-Office petty float / marks next-day refund `ready_for_pickup` (`O-09`), settles daily Merchant CCP payout, verifies a Merchant, and confirms Two-Part Conservation panel reads `Balanced (0 DZD difference)`.
  - *Failure:* Agent entering non-preset amount, attempting `Reject` without mandatory reason, or exceeding Cash Exposure Limit receives clear accessible alert; Admin entering `10,000 DZD` received against `15,000 DZD` collected sees explicit `5,000 DZD` shortage warning inside confirmation modal before placing batch in `shortage_hold`.
- **Acceptance criteria:**
  - [ ] **Agent Portal:** Shows exposure limit meter (`50,000 DZD` Individual / `250,000 DZD` Fixed Office — explicitly labeled cash exposure cap, not spendable float) with **`80%` threshold warning banner/notification**, side-by-side Step 2 **Physical Passport Check modal** (one-click **Approve** or **Reject** with mandatory reason; zero manual passport typing per `O-02`), fixed-preset Cash-Receipt confirmation modal, hand-in batch submission, and refund payout screen distinguishing walk-in `<= 20,000 DZD` petty float vs `ready_for_pickup` next-day batches (`O-09`).
  - [ ] **Merchant Portal:** Displays manual verification status badge, **Monthly B2B Subscription status badge (`subscription_active` vs `subscription_past_due`), renewal warning banner + `DEMO_MODE` reminder cues (`O-06b`)**, API key/secret management (masking secrets after initial reveal), Merchant Payable Balance (unaffected even when subscription is `past_due`), sales/`2%` transaction fee breakdown, Daily CCP Payout history with semantic status badges, and notification feed updates.
  - [ ] **Admin Dashboard:** Manages agents/offices & Fixed-Office `refund_petty_float_balance` (`O-09`), confirms Option B hand-ins & `shortage_hold` batch reconciliations via explicit confirmation modals, funds next-day scheduled refunds (`scheduled_next_day_pickup -> ready_for_pickup`), reviews passport anomalies/rejections, verifies merchants, **confirms/renews monthly B2B merchant subscriptions (`2,000 DZD/month` default, `past_due -> active`) via confirmation modal (`O-06b`)**, configures centralized limits/fees/subscription rates, settles daily CCP payouts, suspends accounts via mandatory-reason modal, inspects audit logs & unread queue badges, and views Two-Part Conservation card.
  - [ ] Persistent simulated-money banner & essential-only cookie footer notice on all portals; semantic accessible status badges (`_docs/design-system.md` Section 3 including `prechecked_pending_agent`, `passport_rejected`, `subscription_active`, `subscription_past_due`, `scheduled_next_day_pickup`, `ready_for_pickup`, `cancelled`, `expired`); zero hardcoded admin credentials in UI or client bundle; `npm run build` passes cleanly.
- **Out of scope:** Public URL hosting deployment (`Future`); automated AI dashboards (`Dropped`).
- **Dependencies:** Backend APIs (Milestones 1–8), Task 13 shared design/notification components, Lyna stop-point approvals.
- **Relevant existing implementation or files:** `src/client/`, `src/client/App.jsx`, `_docs/design-system.md`.
- **Constraints:** Follow `_docs/design-system.md` strictly; no hardcoded admin passwords/demo login autofills containing admin secrets; no unauthorized packages.
- **Documentation & diagrams to update:** `docs/01-system-architecture.md`, `docs/06-devops-testing-and-workflow.md`.
- **Testing expectations:** `npm run build`, `npm test`, and independent QA walkthrough across Agent, Merchant, and Admin portals honoring per-area Milestone Stop Points.
- **Open owner decisions:** `None` (inherits final backend decisions `O-07`/`O-08` prior to Milestone 9 UI).

#### Task 35: Demonstration External E-Commerce Website Integration & Full Regression Verification
- **Status:** `Ready for Grooming / Active Blendinar v1` *(depends on Tasks 27–30 & Task 13)*
- **Goal:** Connect Lyna's existing external e-commerce website as a **demonstration merchant** using Blendinar's merchant API credentials and Hosted Checkout redirect flow, and verify end-to-end payment, fee deduction, CCP payout, and simulated-money notices.
- **In plain words:** Hooks up Lyna's real demo online store to Blendinar so anyone reviewing the project can add an item to cart on an external shop, click "Pay with Blendinar", pay safely from a topped-up tourist wallet on Blendinar's checkout page, and see the order complete cleanly.
- **Product plan rules & requirements:** `_docs/plan.md` Section `2` (*Demonstration Merchant*), `R9-B`, Checks `23`–`24`.
- **User scenarios:**
  - *Happy path:* Demo store creates a `5,000 DZD` checkout session -> shopper is redirected to Blendinar Hosted Checkout -> confirms with password (`0 DZD` customer fee) -> Blendinar credits demo store payable balance (`5,000 - fee`) and redirects shopper back to demo store confirmation page.
  - *Failure:* Demo store sends tampered signature/key -> `401`; shopper cancels or lacks spendable funds -> redirected to `cancel_url` / shown clear retry state with zero charge.
- **Acceptance criteria:**
  - [ ] Integration guide and demo configuration connect Lyna's existing e-commerce website to Blendinar's Merchant API and Hosted Checkout without modifying Blendinar core business rules.
  - [ ] End-to-end demo walk-through verifies: external store checkout initiation -> Hosted Checkout trust badges & `0 DZD` fee -> customer password payment -> callback/return to store -> merchant payable balance & Blendinar fee update -> simulated CCP payout readiness.
  - [ ] Simulated-money notice stays visible throughout external handoff and Hosted Checkout.
- **Out of scope:** Turning Blendinar into an e-commerce site builder (`Confirmed` excluded); live real-money bank settlement (`Future`).
- **Dependencies:** Tasks 12/27, 28, 29, 30, 13, and Lyna approval of demo merchant connection details.
- **Relevant existing implementation or files:** `src/routes/merchant.js`, `src/routes/customer.js`, `src/client/`, `README.md`, `docs/01-system-architecture.md`.
- **Constraints:** Keep demo merchant keys in environment variables only (never commit real secrets); do not alter Cohort Baseline `main`.
- **Documentation & diagrams to update:** `README.md` (demonstration merchant walk-through), `docs/01-system-architecture.md` (external merchant integration sequence diagram).
- **Testing expectations:** Automated integration test simulating external merchant server-to-server session creation + redirect callback verification + full `npm test` and `npm run build` pass.
- **Open owner decisions:** `None` (Lyna supplies local/demo merchant URL at integration time).

---

## Part 4 — Explicitly Deferred / Excluded Future Features

The following backlog tasks and capabilities are **explicitly excluded from Blendinar v1** (`_docs/plan.md` Section 9):

### Deferred Baseline Tasks
- **Task 10 (`#14`) — Customer-to-Customer Peer Transfers (`R10`):** `Deferred / Future` *(resolved via `O-11 Delegated` — remains `Future` and excluded from v1)*.
- **Task 11 (`#15`) — Admin Erroneous-Transaction Reversals (`R11`):** `Deferred / Future` *(distinct from v1 Customer Unused-Balance Cash Refunds in Tasks 31–32)*.
- **Task 15 Remaining (`#20`) — Public URL Deployment:** `Deferred / Future` *(Docker Compose & CI active; live Render/public deployment remains post-v1)*.

### All 14 Excluded Product Items (`_docs/plan.md` Section 9)
1. Custom / arbitrary cash top-up amounts outside centralized fixed presets (**Future**).
2. Automated passport scanning / OCR verification (**Future** — never assume free, easy, or supporting Algerian passports).
3. National ID card verification beyond passports (**Future**).
4. Instagram-only merchants without a website and DM payment links (**Future**).
5. Automated customer-to-agent matching (**Future**).
6. In-app appointment scheduling with agents (**Future**).
7. International bank card top-ups (**Future**).
8. Customer bank or post cash deposits directly to Blendinar (**Future**).
9. Top-up Option A (agent prepaid float) and Option C (third-party settlement network) (**Future**).
10. Agent commissions, bonuses, payroll, or salary management (**Confirmed** excluded from v1).
11. Real bank, BaridiMob, or Algérie Poste CCP API integrations (**Future**).
12. Multi-currency wallets, FX conversion, or international/post-departure bank refunds (**Future**).
13. Support-agent role, peer transfers (`R10`), erroneous-transaction reversals (`R11`), and Arabic/French UI localization (**Future**).
14. **AI Assistant / AI Milestone:** **Explicitly Dropped** (NOT active backlog and NOT postponed to a future milestone).
