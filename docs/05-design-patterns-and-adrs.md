# 05 — Design Patterns & Architectural Decision Records (ADRs)

## 1. Reusable Coding Recipes (**Design Patterns**)

A **design pattern** is a proven, reusable solution to a common software problem. Patterns used in this codebase include:

| Pattern Name | Plain-English Meaning | Where It Is Used |
| :--- | :--- | :--- |
| **Layered Architecture** | Splitting code into clean floors (Routes -> Security -> Business Services -> Database) so each layer has one clear responsibility. | `src/routes/`, `src/middleware/`, `src/services/`, `src/db/` |
| **Chain of Responsibility** | Passing an HTTP request through sequential checkpoints (`cors` -> `express.json` -> `requireAuth` -> `requireRole` -> handler). | `src/app.js` & `src/routes/*.js` |
| **Dependency Injection (Default Parameter)** | Allowing service functions to accept `dbClient = db` so callers can pass an active `tx` transaction handle or default pool. | `src/services/wallet.js` & `src/services/payment.js` |
| **Pluggable Provider (Strategy Pattern)** | Keeping replaceable delivery mechanics behind one function so real email/SMS providers can plug in later without rewriting auth. | `sendOtp` in `src/services/otp.js` |
| **Idempotent Receiver** | Storing processed request identifiers so safe client retries return the original receipt instead of charging twice. | `idempotency_keys` in `src/services/payment.js` (scoped upgrade in Task 16) |
| **Deterministic Lock Ordering** | Locking involved wallet/account rows in ascending numeric ID order (`sort((a, b) => a - b)`) so concurrent transactions cannot deadlock. | `src/services/wallet.js` & `src/services/payment.js` |
| **State Machine + Lazy Expiration** | Guarding explicit status transitions (`pending` -> `completed` / `expired`) and checking clock expiry at lookup/confirm time. | `payment_requests` in `src/services/payment.js` |
| **Append-Only Audit Log** | Inserting immutable ledger rows in `transactions` and never modifying or deleting past financial history. | `transactions` & `recordTransaction` |

---

## 2. Architectural Decision Records (**ADRs**)

An **ADR** captures **why** a foundational engineering decision was chosen, what alternatives were weighed, and what trade-offs remain. Historical Cohort v0 ADRs (`ADR-001`–`ADR-007`) are preserved below alongside Blendinar v1 ADRs (`ADR-008`–`ADR-012`).

---

### ADR-001: Use PostgreSQL + Drizzle ORM (Instead of NoSQL like MongoDB)
* **Question:** What database should store wallets and financial ledgers?
* **Choice:** **PostgreSQL 16** with **Drizzle ORM** and forward-only migrations in `drizzle/`.
* **Alternatives:** Document databases like MongoDB (harder multi-document locking semantics and no native column-level SQL `CHECK (balance >= 0)` guarantees).
* **Result:** Strong ACID transactions, `SELECT ... FOR UPDATE`, and database-enforced invariants.

### ADR-002: Store Money as Whole Centimes (`bigint`), Not Decimals
* **Question:** How should monetary amounts be represented?
* **Choice:** Accept whole Algerian Dinars (DZD) from users and persist `dinars * 100` as whole integer centimes in PostgreSQL `bigint`.
* **Alternatives:** JavaScript IEEE-754 floats (binary rounding drift) or SQL `DECIMAL` strings requiring external decimal math packages.
* **Result:** Exact integer math ready for centime-level fees, paired with safe integer overflow bounds (`Math.floor(Number.MAX_SAFE_INTEGER / 100)` enforced across Blendinar in Task 16).

### ADR-003: Pessimistic Row Locking (`FOR UPDATE`) Instead of Optimistic Retries
* **Question:** How should concurrent balance mutations avoid double spending?
* **Choice:** Pessimistic locking (`SELECT ... FOR UPDATE`) in deterministic ascending ID order inside `db.transaction`.
* **Alternatives:** Optimistic version counters requiring custom application retry loops.
* **Result:** Simple, race-free serialization with zero lost updates; slight queueing only on hot rows under heavy contention.

### ADR-004: Only Admins Can Create Money (`admin_load`) — `[Superseded by ADR-008]`
* **Historical Context (Cohort Baseline v0):** In Cohort v0, Admins loaded balances into physical merchant shops (`adminLoadShopBalance`), and shops funded customer cash top-ups out of their shop balance (`merchantTopUp`).
* **Disposition:** **`[Superseded by ADR-008]`** in Blendinar v1, where employee Agents collect physical cash into **Pending (Not Yet Spendable)** top-ups and spendable digital value enters **only** when an Administrator confirms the Agent's physical cash hand-in (**Option B**).

### ADR-005: Split `src/app.js` from `src/index.js`
* **Question:** How should the Express API and React/Vite frontend coexist?
* **Choice:** Export the Express app in `src/app.js` without binding a port; bind `PORT` and attach Vite/static `dist/` serving in `src/index.js`.
* **Result:** Fast in-memory Supertest integration tests without open ports, and same-origin production serving without CORS friction.

### ADR-006: Simulated OTP Behind a `DEMO_MODE` Switch — `[Extended / Partially Superseded by ADR-009]`
* **Historical Context (Cohort Baseline v0):** Cohort v0 routed phone-number SMS OTP delivery through `sendOtp()` and exposed retrieval routes only outside production or when `DEMO_MODE=true`.
* **Disposition:** **`[Extended / Partially Superseded by ADR-009]`** — Blendinar v1 retains `sendOtp()` and the `DEMO_MODE` safety switch (`isOtpExposed()`) while migrating customer sign-up/verification from phone-required to **email-required + simulated email OTP** with phone strictly optional.

### ADR-007: Run Real-PostgreSQL Test Files Sequentially (`--no-file-parallelism`)
* **Question:** How should automated tests exercise real PostgreSQL locks and constraints cleanly?
* **Choice:** Run all **10 test files (137 automated tests)** sequentially (`vitest run --no-file-parallelism`) against a real PostgreSQL instance with per-test table cleanup (`cleanDb()`).
* **Result:** Proves real SQL `CHECK` constraints and row locks work authentically without parallel test files truncating each other's rows.

---

### ADR-008: Option B Employee Agent Cash Collection & Admin Hand-In Release *(Supersedes ADR-004)*
* **Question:** How should physical DZD cash enter Blendinar for tourists/foreigners without trusting third-party shops to mint spendable funds on demand?
* **Choice:** **Option B** (`R8-B`): Cash is collected solely by Blendinar **employee Agents** (Fixed-Location Offices / "Partner Points" capped at **`250,000 DZD`** exposure vs. Individual Agents capped at **`50,000 DZD`** exposure per **`O-04 Delegated`**) — not a prepaid float. Recording a fixed-preset cash collection (`[1k, 2k, 5k, 10k, 20k]` DZD, checking `Spendable + Pending + NewTopUp <= 200,000 DZD`) creates a **Pending (Not Yet Spendable)** record; Customer Spendable Balance is credited **only** after an Administrator confirms the Agent's physical cash hand-in. On cash shortages, the entire short batch enters **`shortage_hold`** with zero ambiguous releases until Admin reconciles cash-backed receipts (`O-05 Confirmed`).
* **Alternatives Considered:** Option A (prepaid agent float — rejected for v1) and Option C (third-party settlement network — rejected for v1).
* **Trade-Offs:** Eliminates unbacked digital money creation and arbitrary partial shortage allocation, at the cost of waiting for Admin hand-in confirmation before top-ups become spendable (and requiring **`O-09`** resolution for funding cash refunds post-hand-in).

### ADR-009: Email-First Customer Registration with Simulated Email OTP & Optional Phone Backup Recovery *(Extends / Partially Supersedes ADR-006)*
* **Question:** How should tourists and foreigners without Algerian SIM cards register, authenticate, and recover lost email access?
* **Choice:** Require **email + password** verified via simulated 6-digit **email OTP** behind `sendOtp()` + `DEMO_MODE`, while making **phone optional** (normalizing blank phones to `NULL` so multiple phone-less users do not collide). If a customer optionally adds and verifies a phone number, they can request a 6-digit simulated recovery OTP to that phone (`sendOtp` in `DEMO_MODE`) to recover account access / reset password (`O-01 Confirmed`).
* **Rationale:** Accessibility for travelers lacking local phone numbers plus practical backup recovery for customers who provide a verified phone (not a claim that email is inherently more secure than SMS).

### ADR-010: Two-Step Hybrid Passport-Only Verification in v1 (`O-02 Confirmed` Workaround)
* **Question:** What identity document scope and verification flow should Blendinar v1 support so physical verification stays genuine without turning employee Agents into manual KYC data-entry guards?
* **Choice:** **Passport-only** verification in v1 via a **2-Step Hybrid Flow** (`O-02 Confirmed`):
  1. **Step 1 — Customer In-App ICAO MRZ Pre-Scan:** Prior to first top-up, the customer submits passport details / simulated 2-line **ICAO MRZ** in-app. The verifier validates MRZ mathematical check digits, expiry date, and name match, enforces `1` account per passport using a unique **SHA-256 hash of `(issuing_country, passport_number)`**, stores masked hint/country/expiry (**never storing raw passport scan photos**), and sets status to **`prechecked_pending_agent`**.
  2. **Step 2 — Agent Physical Double-Check at First Top-Up:** When the customer presents their physical passport at their first cash top-up, the Agent Portal displays the pre-checked summary side-by-side (zero manual passport typing by the Agent). The Agent physically compares the passport to the customer and clicks **Approve** (`passport_verified = true`) or **Reject** (`passport_rejected`, mandatory reason). Anomalies route to Admin review; real third-party camera OCR APIs and National ID cards remain **Future**, and real-world legal sufficiency remains **Unverified**.
* **Trade-Offs:** Eliminates pure self-service trust gaps while avoiding slow manual Agent typing or sensitive raw photo storage, keeping all 4 KYC/top-up stages deterministically testable.

### ADR-011: External Merchant Websites, Hosted Checkout, Two-Stream Merchant Revenue (`O-06` + `O-06b`) & Daily Simulated CCP Payouts
* **Question:** How should Blendinar integrate with online merchants, sustain revenue on zero-sale days, and settle merchant earnings?
* **Choice:** Merchants keep their own websites (`R9-B`), register website + category + CCP details, start `Unverified` with lower limits (`Open O-07`) until manually verified by Admin, create server-side checkout sessions via API Key + hashed Secret, and redirect buyers to **Blendinar Hosted Checkout** (`0 DZD` customer fee). Revenue follows a **Two-Stream Merchant Revenue Model** (**`O-06` Confirmed + `O-06b` Confirmed/Delegated**):
  1. **Stream 1 — Separate Monthly B2B Platform Subscription (`O-06b` Confirmed Separation / Delegated Monthly Cadence):** Merchants pay a separate simulated B2B subscription (`merchant_subscriptions`: `active | past_due | canceled`, defaulting to **`2,000 DZD/month`**, admin-configurable and Admin-confirmed) completely outside customer payment balances and Section 5.6 customer-funds conservation. If a subscription is `past_due`, creating **new** Hosted Checkout sessions is blocked (`403 Merchant subscription required`) with a renewal banner/notification, while already-earned `Merchant Payable` still settles normally via daily CCP payouts (never confiscated, `CHECK >= 0`).
  2. **Stream 2 — `2%` (`200` bps) Per-Sale Transaction Fee (`O-06 Confirmed`):** Completely separate from Stream 1, Blendinar deducts a configurable **`2%` (`200` bps)** fee strictly in integer centimes (`Math.round(amountCentimes * 200 / 10000)`, min `1` centime when fee > 0, rejecting `fee >= paymentAmount`) into Blendinar Accumulated Transaction Fees, credits `gross - fee` to Merchant Payable, and settles payable balances via **Daily Simulated CCP Payout Batches** reviewed and confirmed by Admin (`R13`, cutoff/threshold **`Open O-08`**).
* **Trade-Offs:** Covers fixed platform costs across zero-sale days without forcing negative merchant balances or mixing B2B subscriptions into customer-backed digital conservation (`H_confirmed`), while avoiding e-commerce store building or live bank/CCP integration in v1.

### ADR-012: Immediate Refund Locks (`O-09` Hybrid Petty Float + Next-Day Pickup, `O-10` 72h Expiry), Live Read-Only Suspension & Scoped Idempotency (`(user_id, endpoint, key)`)
* **Question:** How does Blendinar prevent double-spending during cash refunds, guarantee cash availability under Option B hand-ins, handle suspended accounts fairly, and close idempotency gaps identified in Cohort v0?
* **Choice:**
  1. **Immediate Atomic Refund Lock + Hybrid Option 4 Payout (`R14`, `O-10 Confirmed`, `O-09 Confirmed`):** Requesting a pre-departure cash refund immediately locks funds from `Spendable Balance` into `Locked Refund Balance` inside a `FOR UPDATE` transaction; customers may cancel anytime before payout and uncollected requests auto-expire after **72 hours**, atomically returning funds to Spendable Balance (with pre-72h reminders in-app). Under **Confirmed `O-09` Option 4 (Hybrid)**: Fixed-Location Offices hold a small Admin-funded petty-cash float for walk-in refunds **`<= 20,000 DZD`** while float suffices; refunds **`> 20,000 DZD`** (or when office petty float is insufficient) transition to **`scheduled_next_day_pickup` -> `ready_for_pickup`** funded by Admin treasury at the selected Fixed Office, paired with a persistent pre-departure planning banner advising travelers to request refunds >= 24h before departure.
  2. **Live Suspension Enforcement with Read-Only Mode (`R15`, `O-03 Confirmed`):** `requireAuth` checks live PostgreSQL `users.status` on every authenticated request. Suspended customers retain **Read-Only login** (`GET` profile, separated 3 balances, history, reason) so preserved money is transparent, while all financial/state-changing actions reject immediately with `403 Account suspended` and in-flight items remain held for Admin review.
  3. **Hardened Scoped Idempotency (`R12-B`, Task 16):** Replace global `UNIQUE(key)` with composite `(user_id, endpoint, key)` + `request_hash` validation, run inside/with transaction conflict handling, and strictly execute **auth, live suspension, and password verification BEFORE returning any cached idempotent response**.
* **Trade-Offs:** Adds Fixed-Office petty-float ledger tracking and one indexed `users.status` check per authenticated request in exchange for guaranteed tourist cash payout certainty under Option B, instant account-suspension safety, and race-free idempotency.
