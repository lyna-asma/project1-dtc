# Testing Guidelines

This document defines mandatory testing standards for Blendinar so every financial rule, security boundary, and concurrency guarantee is proven against a **real PostgreSQL database**.

---

## 1. Test Stack & Execution Model

- **Test Runner & HTTP Harness:** Vitest + Supertest (`app` imported directly from `src/app.js` without binding a TCP port).
- **Real Database Execution (`--no-file-parallelism`):** `npm test` runs `vitest run --no-file-parallelism` (configured in `package.json`). Test files run sequentially against PostgreSQL, resetting tables cleanly between tests (`cleanDb()`), so real PostgreSQL transactions, `SELECT ... FOR UPDATE` row locks, unique indexes, and `CHECK` constraints are tested authentically without cross-file truncation interference.
- **Commands:**
  - Full suite: `npm test`
  - Single file: `npx vitest run tests/health.test.js` (replace with any target file)

---

## 2. Current Verified Baseline (Cohort v0)

Before Blendinar v1 implementation begins, the verified repository baseline consists of **10 test files and 137 automated tests** under `tests/`:

| Test File | Tests | Scope Covered Today |
| :--- | :---: | :--- |
| `tests/health.test.js` | 2 | `/health` and `/api/health` readiness |
| `tests/auth-register.test.js` | 16 | Phone registration, validation, duplicate blocking, simulated OTP creation & verification |
| `tests/otp-demo-mode.test.js` | 4 | `isOtpExposed()`, hiding simulated OTP logs/`GET /api/auth/otp/:phone` in production unless `DEMO_MODE=true` |
| `tests/auth-login.test.js` | 6 | Password hash verification, unverified account blocking, JWT issuance |
| `tests/rbac.test.js` | 15 | Auth token enforcement (`401`) and role/self isolation (`403`) across baseline roles (`customer`, `merchant`, `admin`) |
| `tests/wallet-ledger.test.js` | 18 | Zero-balance initialization, centime math, customer balance & isolated ledger history |
| `tests/admin-load.test.js` | 23 | Admin shop balance loading, validation boundaries, and crash-rollback proof |
| `tests/merchant-topup.test.js` | 27 | Baseline shop-float cash top-up, balance checks, self-top-up block, rollback proof |
| `tests/payment.test.js` | 23 | 5-minute single-use payment codes, password verification, expiry, rollback proof |
| `tests/payment-concurrency.test.js` | 3 | Payment idempotency, dual simultaneous 800 DA payments on 1,000 DA balance, and baseline balance conservation |

> **Important Distinction:** Items marked **Blendinar Target Rule** below specify mandatory test standards for upcoming Blendinar v1 features (such as Option B top-ups, 4 roles, email OTP, suspended accounts, scoped idempotency upgrades, configurable merchant fees, CCP payouts, and customer refunds). Do not assume target behaviors already exist in `src/` until their corresponding tasks are implemented and tested.

---

## 3. Financial Testing Rules

### A. Whole DZD & Integer Centimes (`dinars * 100`)
- Always verify amounts are entered in whole Algerian Dinars (DZD) and persisted in PostgreSQL `bigint` columns as integer centimes (`dinars * 100`).
- Every financial input endpoint must have negative boundary tests rejecting:
  - Decimals / floats (e.g., `100.5`, `0.01`)
  - Zero (`0`) and negative numbers (`-1`, `-500`)
  - Non-numeric types (`"1000"`, `null`, `undefined`, `{}`), `NaN`, and `Infinity`
- **Integer Overflow Guard (Blendinar Target Rule):** Explicitly test rejection of `amountDinars > Math.floor(Number.MAX_SAFE_INTEGER / 100)` so `amountDinars * 100` can never exceed `Number.MAX_SAFE_INTEGER` before saving to PostgreSQL `bigint`. *(Note: baseline `src/services/wallet.js` and `src/services/payment.js` currently check `Number.MAX_SAFE_INTEGER` before multiplying by `100`; Blendinar tasks must tighten and test this at `Math.floor(Number.MAX_SAFE_INTEGER / 100)`.)*

### B. Atomic Rollback & Fault Injection (`_testFailureAfterBalanceUpdate`)
- Every multi-step money mutation (top-ups, hand-in confirmation, payments, fee recording, CCP payout settlement, refund lock/payout) must include an automated rollback test injecting `_testFailureAfterBalanceUpdate: true` after balance mutation and before commit.
- Verify that after the simulated failure:
  - No wallet balance changed.
  - No partial ledger row, payment completion, hand-in confirmation, or idempotency record persisted.
- Verify that routes force `_testFailureAfterBalanceUpdate` to `false` when `NODE_ENV === 'production'`.

### C. Database `CHECK` Constraints & Append-Only Ledger
- Verify `CHECK (balance >= 0)` and `CHECK (amount > 0)` cannot be bypassed.
- Verify transaction history is strictly append-only (no `UPDATE` or `DELETE` on `transactions`; reversing/offsetting creates new ledger records).

---

## 4. Concurrency Testing Rules (`Promise.all`)

Every money-critical race condition must have real concurrent `Promise.all` tests against PostgreSQL proving deterministic `SELECT ... FOR UPDATE` serialization:

1. **Simultaneous Payment Race (Baseline + Blendinar):**
   - Two simultaneous `800 DA` payments from a `1,000 DA` balance: exactly one returns `200`, one returns `400` (`Insufficient ...`), final customer balance is `200 DA`, and only one ledger debit exists.
2. **Option B Double Hand-In Confirmation Race (Blendinar Target):**
   - Two simultaneous admin confirmation requests for the same pending top-up / hand-in batch: confirmed **once** only, customer spendable balance credited **once**, no double-credit.
3. **Simultaneous Checkout Payment Attempts (Blendinar Target):**
   - Concurrent confirmations for the same checkout session / payment request: at most one succeeds, remaining attempts fail cleanly (`400`/`409`) with zero double-charge.
4. **Payment vs. Refund Lock Race (Blendinar Target):**
   - A customer with `3,000 DA` spendable balance concurrently submits a `3,000 DA` merchant payment and a `3,000 DA` cash refund lock: exactly one succeeds, the other rejects for insufficient spendable balance, preventing double-use of the same `3,000 DA`.
5. **Daily CCP Payout Cutoff / Double-Run Race (Blendinar Target):**
   - Concurrent payout batch preparation or settlement triggers for the same merchant payable balance / cutoff window: settled at most once, never negative or double-paid.
6. **Concurrent Stress Suites:**
   - Multi-request (e.g., 50-request) `Promise.all` contention tests verifying zero deadlocks, zero lost updates, and exact conservation invariant after mixed concurrent success/failure outcomes.

---

## 5. Idempotency Testing Rules

Every idempotent endpoint test suite must verify:

1. **Same Key Replay:** Sending the exact same valid request twice with the same idempotency key executes the financial mutation once and returns the identical cached receipt (`transaction.id`, balances, status code).
2. **Composite Scoping `(user_id, endpoint, key)` (Blendinar Target):**
   - User A and User B submitting the **same** key string (e.g., `"retry-1"`) do **not** collide or fail; each operates independently under their own `user_id`.
   - The same user reusing the same key string across **different endpoints** (e.g., payment vs. refund) does **not** collide or return the wrong endpoint's receipt.
3. **Payload Mismatch Rejection (Blendinar Target):**
   - Reusing an idempotency key for the same `(user_id, endpoint)` with different request payload/target parameters must be rejected with a clear client error (`400`/`409`/`422`), never silently replaying an incompatible receipt.
4. **Auth & Password Verification BEFORE Replay (Blendinar Target):**
   - Replaying a request with an already-used idempotency key while supplying an invalid/expired JWT, a suspended account, or a **wrong confirmation password** must return `401` or `403` and **must never** return the cached `200` response.
5. **Concurrent Same-Key Race:**
   - Two identical-key requests sent concurrently via `Promise.all` execute the money movement once without `500` errors or duplicate ledger rows.

---

## 6. Negative Security, Suspension & RBAC Tests

- **4-Role RBAC Coverage (Blendinar Target):** Test unauthorized (`401`) and forbidden (`403`) access across all 4 roles (`customer`, `agent`, `merchant`, `admin`) plus cross-user resource isolation (e.g., Customer A cannot read Customer B's balance, pending top-ups, refunds, or history; Agent A cannot confirm another agent's records or access admin endpoints).
- **Suspended Accounts (Blendinar Target):**
  - Test that `requireAuth` checks **live account status** (not just JWT signature/expiry) so once an admin suspends an account, even previously issued valid JWTs are immediately rejected on protected/financial operations.
  - Verify suspension **never** deletes or zeroes out existing balances or historical ledger records.
- **Unverified Merchant Limits (Blendinar Target):**
  - Test that unverified merchants are restricted by the configured lower transaction limits while verified merchants use standard limits.
- **OTP `DEMO_MODE` Safety:**
  - Preserve and extend `tests/otp-demo-mode.test.js` coverage ensuring simulated OTPs are never logged or exposed over HTTP when `NODE_ENV === 'production'` and `DEMO_MODE !== 'true'`.

---

## 7. Financial Conservation Invariant Assertions

After every sequential and concurrent test sequence, explicitly query PostgreSQL directly and assert conservation in integer centimes:

1. **Baseline Cohort v0 Invariant (Verified Today in `tests/payment-concurrency.test.js`):**
   $$\sum \text{All Wallet Balances} = \sum \text{Admin Shop Loads}$$

2. **Blendinar Two-Part Conservation Invariant (`Proposed — Awaiting Lyna's Approval`):**
   *(Matches [`_docs/plan.md`](./plan.md) Section 5.6 identically; all quantities are integer centimes `bigint`.)*
   - **Part 1 — Digital Value Conservation:**
     $$C_{\text{spend}} + C_{\text{locked}} + M_{\text{payable}} + F_{\text{acc}} + R_{\text{paid}} + P_{\text{settled}} = H_{\text{confirmed}}$$
   - **Part 2 — Top-Up Cash Custody Conservation:**
     $$A_{\text{collected\_valid}} = T_{\text{pending}} + H_{\text{confirmed}}$$
   - **Unified Reconciliation Identity:**
     $$C_{\text{spend}} + C_{\text{locked}} + M_{\text{payable}} + F_{\text{acc}} + R_{\text{paid}} + P_{\text{settled}} + T_{\text{pending}} = A_{\text{collected\_valid}}$$

   Where:
   - $C_{\text{spend}}$ = sum of all customer Spendable Balances
   - $C_{\text{locked}}$ = sum of all active customer Locked Refund Balances
   - $M_{\text{payable}}$ = sum of all unpaid Merchant Payable Balances
   - $F_{\text{acc}}$ = total Blendinar Accumulated Fees from completed payments
   - $R_{\text{paid}}$ = total physical cash refunds marked `paid` to customers
   - $P_{\text{settled}}$ = total daily merchant CCP payouts marked `settled`
   - $H_{\text{confirmed}}$ = total customer top-up value released via Admin-confirmed cash hand-ins
   - $T_{\text{pending}}$ = total top-up amounts still `pending_hand_in` / `shortage_hold` / `disputed` awaiting confirmation
   - $A_{\text{collected\_valid}}$ = total valid cash top-up amounts collected and recorded by Agents (excluding invalid/voided receipts)

   **7-Step Reference Numerical Trace (`_docs/plan.md` Section 5.6 — whole DZD; `× 100` centimes in DB; `2%` / `120 DZD` illustrative placeholder fee only):**

   | Step | Event | $C_{\text{spend}}$ | $C_{\text{locked}}$ | $M_{\text{payable}}$ | $F_{\text{acc}}$ | $R_{\text{paid}}$ | $P_{\text{settled}}$ | $H_{\text{confirmed}}$ | $T_{\text{pending}}$ | $A_{\text{collected\_valid}}$ |
   | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
   | **0** | Initial empty system | 0 | 0 | 0 | 0 | 0 | 0 | **0** | 0 | **0** |
   | **1** | Agent records `10,000` DZD pending top-up | 0 | 0 | 0 | 0 | 0 | 0 | **0** | 10,000 | **10,000** |
   | **2** | Admin confirms `10,000` DZD cash hand-in | 10,000 | 0 | 0 | 0 | 0 | 0 | **10,000** | 0 | **10,000** |
   | **3** | Customer pays `6,000` DZD (`120` placeholder fee) | 4,000 | 0 | 5,880 | 120 | 0 | 0 | **10,000** | 0 | **10,000** |
   | **4** | Admin settles `5,880` DZD daily CCP payout | 4,000 | 0 | 0 | 120 | 0 | 5,880 | **10,000** | 0 | **10,000** |
   | **5** | Customer locks remaining `4,000` DZD refund | 0 | 4,000 | 0 | 120 | 0 | 5,880 | **10,000** | 0 | **10,000** |
   | **6** | Agent verifies passport & pays `4,000` DZD cash | 0 | 0 | 0 | 120 | 4,000 | 5,880 | **10,000** | 0 | **10,000** |

---

## 8. Test Integrity Rules

- **Never** delete, comment out, skip (`it.skip`), or weaken an existing test assertion just to make failing changes pass.
- **Never** hardcode default admin passwords or phone credentials in documentation or shared public templates.
- **Never** claim tests passed unless `npm test` ran completely after your final edit and every test file and case was observed passing.
