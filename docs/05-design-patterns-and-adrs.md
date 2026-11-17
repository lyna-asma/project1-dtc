# 05 — Design Patterns & Architectural Decision Records (ADRs)

## 1. Reusable Coding Recipes (**Design Patterns**)

A **design pattern** is a proven, reusable solution to a common software problem. Here are the patterns used in this codebase, explained simply:

| Pattern Name | Plain-English Meaning | Where It Is Used |
| :--- | :--- | :--- |
| **Layered Architecture** | Splitting code into neat floors (Routes → Security → Business Rules → Database) so each part has one job. | `src/routes/`, `src/middleware/`, `src/services/`, `src/db/` |
| **Chain of Responsibility** | Passing a web request through a line of checkpoints (`cors` → JSON parser → `requireAuth` → `requireRole` → handler). Any checkpoint can stop it early. | `src/app.js` & `src/routes/*.js` |
| **Dependency Injection (Default Parameter)** | Letting a function accept a database connection (`dbClient = db`) as an optional argument. Normally it uses the main database, but inside a transaction it can use the active `tx` lock. | `src/services/wallet.js` & `src/services/payment.js` |
| **Pluggable Provider (Strategy Pattern)** | Hiding a replaceable detail (like sending an SMS) behind a single function so you can swap it later without touching the rest of the app. | `sendOtp` in `src/services/otp.js` |
| **Idempotent Receiver** | Remembering processed request IDs so accidental retries return the saved receipt instead of charging twice. | `idempotency_keys` in `src/services/payment.js` |
| **Deterministic Lock Ordering** | Always locking two wallets in ascending ID order (`min` then `max`) so two users can never freeze each other in a deadlock. | `walletIdsInOrder.sort((a, b) => a - b)` |
| **State Machine + Lazy Expiration** | Tracking allowed statuses (`pending` → `completed` or `expired`) and checking the clock when a code is used instead of running a background timer. | `payment_requests` in `src/services/payment.js` |
| **Append-Only Audit Log** | Only ever adding new rows to the history table—never editing or deleting old ones. | `transactions` table & `recordTransaction` |

---

## 2. Architectural Decision Records (**ADRs**)

An **ADR** is a short engineering note explaining **why** a major choice was made, what other options were considered, and what trade-offs came with it.

### ADR-001: Use PostgreSQL + Drizzle ORM (Instead of NoSQL like MongoDB)
* **The Question:** What kind of database should hold wallets and transactions?
* **The Choice:** **PostgreSQL 16** with **Drizzle ORM** (a tool that translates JavaScript into SQL) and versioned migration files in `drizzle/`.
* **Other Options:** MongoDB (a document database, which is harder to use for multi-row money transactions and lacks built-in `CHECK (balance >= 0)` rules).
* **Result:** Strong, built-in safety guarantees (`SELECT ... FOR UPDATE`, `CHECK` constraints) and clean, trackable database updates.

### ADR-002: Store Money as Whole Centimes (`bigint`), Not Decimals
* **The Question:** How should money numbers be stored?
* **The Choice:** Multiply whole Dinars by `100` and store them as whole integer centimes in PostgreSQL `bigint` columns.
* **Other Options:** JavaScript decimal floats (dangerous—causes rounding bugs like `0.1 + 0.2 !== 0.3`), or SQL `DECIMAL` (comes back as text strings in Node.js, requiring extra math libraries).
* **Result:** 100% exact integer math and ready for future centime-level fees.

### ADR-003: Lock Rows Upfront (`FOR UPDATE`) Instead of Retrying After Conflicts
* **The Question:** How should the app handle two people spending from the same wallet at the exact same time?
* **The Choice:** **Pessimistic locking** (`SELECT ... FOR UPDATE`) in ascending wallet ID order—making the second request wait in line until the first finishes.
* **Other Options:** **Optimistic locking** (letting both run, detecting the clash at the end, and writing retry loops in JavaScript).
* **Result:** Simpler, bug-free application code with zero retry loops. Trade-off: if 1,000 people paid the exact same shop at the exact same second, they would wait in a short queue.

### ADR-004: Only Admins Can Create Money (`admin_load`)
* **The Question:** How does money enter the system?
* **The Choice:** Only an Admin can mint new digital money into a shop's wallet. When a shop tops up a customer, it comes out of the shop's own balance.
* **Other Options:** Letting shops create digital money out of thin air whenever someone hands them cash (impossible to audit if a shop cheats).
* **Result:** Total money across all wallets always equals the exact total loaded by the Admin.

### ADR-005: Split `src/app.js` from `src/index.js`
* **The Question:** How should the Express server and React frontend be wired together?
* **The Choice:** Put routes in `app.js` and port-listening / Vite webpage loading in `index.js`.
* **Result:** Automated tests can test `app.js` directly in memory without starting a real network port or Vite, while production serves the built React app from the same server (no cross-origin CORS headaches).

### ADR-006: Fake OTP Behind a `DEMO_MODE` Switch
* **The Question:** How do reviewers and automated tests sign up without real SIM cards or SMS bills?
* **The Choice:** Put OTP delivery in `sendOtp()` and only expose `GET /api/auth/otp/:phone` when not in production, or when `DEMO_MODE=true`.
* **Result:** Free, deterministic tests and easy reviewer demos, while staying safe by default in production.

### ADR-007: Run Test Files One-by-One (`--no-file-parallelism`)
* **The Question:** How should automated tests use PostgreSQL?
* **The Choice:** All 9 test files run against a real PostgreSQL database (no fake/mocked database), wiping tables between tests (`cleanDb()`), so `package.json` runs them one file at a time (`--no-file-parallelism`).
* **Result:** Tests prove real PostgreSQL locks and constraints actually work, without two test files accidentally wiping each other's data at the same time.
