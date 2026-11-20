# Blendinar — Simulated Digital Wallet and Online Merchant Payment Platform

A cash-to-digital wallet and hosted online-merchant payment platform prototype evolved from the AI Dev Tools Zoomcamp 2026 Cohort Baseline.

> **Important Simulated-Money & Regulatory Notice:**
> **All money in Blendinar is 100% fake and simulated.** Physical cash collections, agent hand-ins, daily merchant CCP payouts, and pre-departure customer cash refunds are strictly software simulations for portfolio demonstration. Blendinar is **not** a real bank, licensed financial institution, or payment network, and is not affiliated with BaridiMob, Algérie Poste (CCP), or any existing payment provider. Regulatory, central-bank, AML, and data-protection compliance obligations are marked **Unverified** in [`_docs/plan.md`](./_docs/plan.md).

---

## Product Concept (Blendinar v1 Target)

- **Payment-Step Focus (`Confirmed`):** External businesses keep their own e-commerce or booking websites; Blendinar provides the digital wallet and **Hosted Checkout** payment experience (Blendinar is **not** an e-commerce store builder).
- **Primary Audience (`Confirmed` / `Unverified`):** Built for **tourists and foreigners living in Algeria** who cannot conveniently pay online via BaridiMob or CCP. *(Secondary market demand among local users without BaridiMob/CCP is marked **`Unverified`** in `_docs/plan.md`.)*
- **Passport-Only v1 Verification (`Confirmed`):** Version 1 identity checks cover **passports only** (automated passport OCR scanning and national IDs remain **Future**).
- **Demonstration Merchant (`Confirmed`):** Lyna's existing external e-commerce website will connect to Blendinar as a demonstration merchant once merchant integration tasks are completed.

---

## Users and Roles

> **Current Codebase vs. Target Blendinar Note:** Today, `src/` implements **Cohort Baseline v0** (`3` roles: `customer`, `merchant`, `admin`, phone-number OTP, shop-float cash top-ups, and 6-character payment codes). The **4-role Blendinar v1** architecture below is specified in [`_docs/plan.md`](./_docs/plan.md) and scheduled in [`_docs/tasks.md`](./_docs/tasks.md).

- **Customer (Blendinar v1 Target):**
  - Registers using **email** and password with a simulated 6-digit **email OTP** (`phone` is optional so tourists without Algerian SIMs can sign up).
  - Completes an in-person **passport check** (`Proposed` at first top-up) with an authorized Blendinar employee Agent.
  - Browses the in-app **Agent & Office Directory**, hands physical DZD cash for a fixed preset amount (`[1,000; 2,000; 5,000; 10,000; 20,000]` DZD default), verifies the registered agent and pending record inside their own logged-in account (screenshots/physical badges alone are never proof), and waits for Admin hand-in confirmation (**Option B**) before funds become **Spendable**.
  - Views three strictly separated balance states (**Spendable Balance**, **Pending Top-Ups — Not yet spendable**, and **Locked for Refund**).
  - Pays external online merchants on Blendinar's Hosted Checkout with **`0 DZD` customer fee** and password confirmation.
  - Requests a **`0 DZD`-fee pre-departure cash refund** (immediately locking Spendable Balance) and collects physical DZD cash from an authorized Agent.
- **Agent — Blendinar Employee (Planned in Blendinar v1):**
  - Staffed either at a **Fixed-Location Office ("Partner Point")** or as an **Individual Agent** (employee salaries/commissions are out of scope).
  - Records fixed-preset cash receipts within their **Agent Cash Exposure Limit** (not a prepaid float), hands physical cash in to Admin, verifies passports, and disburses cash refunds.
- **Merchant — External Online Website (Cohort v0 shop-float today -> External Website Hosted Checkout in Blendinar v1):**
  - Registers website URL, business category, CCP payout details, and optional Instagram handle (starts `Unverified` with lower transaction limits until manually verified by Admin).
  - Uses API key + hashed secret to launch Blendinar Hosted Checkout, accrues `gross - configurable merchant fee` in Merchant Payable Balance, and receives **daily simulated CCP payouts**.
- **Administrator (Platform Operator):**
  - Manages employee Agents/Offices, confirms Agent cash hand-ins (`Option B`) and investigates shortages, manually verifies Merchants, configures limits & merchant fees, confirms daily simulated CCP payouts, suspends abusing accounts (strictly preserving balances and append-only history), and audits platform conservation invariants.

---

## Core Financial & Security Rules

1. **Whole Dinars & Integer Centimes (`R3`):** User inputs and UI amounts are whole Algerian Dinars (`DZD` / `DA`). PostgreSQL stores `dinars * 100` in `bigint` columns with zero floating-point math, tightened in Blendinar (**Task 16**) to reject `amountDinars > Math.floor(Number.MAX_SAFE_INTEGER / 100)`.
2. **No Negative Balances & Concurrency (`R4`, `R12-B`):** Enforced via PostgreSQL `CHECK (balance >= 0)` and atomic `db.transaction` blocks using deterministic ascending `SELECT ... FOR UPDATE` row locking.
3. **Append-Only Ledger (`R11`):** Rows in `transactions` are only ever inserted (`INSERT`), never edited or deleted.
4. **Option B Cash Top-Ups (`R8-B`):** Agent-collected cash stays **Pending (Not Yet Spendable)** until Admin confirms the Agent's physical cash hand-in.
5. **Zero Customer Fees & Configurable Merchant Fees (`R6-B`):** Customers pay `0 DZD` fee on top-ups, payments, and refunds in v1; merchants pay a configurable platform fee (`O-06`).
6. **Simulated OTP Behind `DEMO_MODE` (`R7-B`):** Code delivery sits behind `sendOtp` in `src/services/otp.js` and exposes simulated codes only outside production or when `DEMO_MODE=true`.

---

## Current Status: Implemented Today vs. Blendinar v1 Planned

### Implemented and Verified Today (Cohort Baseline v0 in `src/`)
- **Express Layered Backend & Health Checks (Task 1 / `#6`):** `src/app.js`, `src/index.js`, `GET /health` & `GET /api/health`.
- **PostgreSQL 16 + Drizzle ORM Migrations:** 6 baseline tables in `src/db/schema.js` and 4 SQL migrations in `drizzle/`.
- **Phone Auth & Simulated OTP (Task 2 / `#7`):** `POST /api/auth/register`, `GET /api/auth/otp/:phone` (`DEMO_MODE`), `POST /api/auth/verify-otp`.
- **JWT Auth, 3-Role RBAC & Admin Seed (Task 3 / `#8`):** `POST /api/auth/login`, `requireAuth`, `requireRole`, `src/scripts/seed-admin.js`.
- **Centime Wallets & Append-Only Ledger (Task 4 / `#9`):** `GET /api/customer/balance`, `GET /api/customer/transactions`.
- **Admin Shop Load & Shop-Float Cash Top-Up (Tasks 5–6 / `#10`–`#11`):** `POST /api/admin/shops/:merchantId/load`, `POST /api/merchant/top-up` with crash-rollback proofs.
- **5-Minute 6-Char Payment Codes & Baseline Concurrency (Task 7 & partial Task 9 / `#12`–`#13`):** `POST /api/merchant/payment-requests`, `GET /api/customer/payment-requests/:code`, `POST /api/customer/payment-requests/:code/confirm`, idempotency replay, dual-800-DA race, and baseline balance conservation (`tests/payment-concurrency.test.js`).
- **Docker Compose & Multi-Branch CI (partial Task 15 / `#20` + Task 17):** `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml` (`main` + `next-product`).
- **Task 16 Scoped Idempotency & Overflow Guard (`next-product`):** Composite `(user_id, endpoint, key)` + `request_hash`, password check before replay, `pg_advisory_xact_lock`, and `MAX_SAFE_DINARS` validation (`drizzle/0004_elite_titania.sql`, `src/services/validation.js`).
- **Task 18 Secret/Seed Hardening & Blendinar Starter Branding (`next-product`):** Fail-fast production `JWT_SECRET` validation in `getJwtSecret()` / `startServer()`, env-required `seed-admin.js` (zero hardcoded credentials in code, `docker-compose.yml`, or `.env.example`), and Blendinar simulated-money banner + essential-storage footer in `index.html` / `src/client/App.jsx`.
- **Automated Real-PostgreSQL Tests:** **11 test files, 155 passing tests** verified on `next-product` (including `tests/otp-demo-mode.test.js` and `tests/security-hardening.test.js`; **10 test files, 137 tests** in Cohort Baseline v0 on `main`).
- **Frontend Scaffold:** React 19 + Vite 6 + Tailwind CSS 4 Blendinar simulated-money starter shell in `index.html` and `src/client/App.jsx`.

### Planned Blendinar v1 Scope (`_docs/plan.md` & `_docs/tasks.md` Milestones 2–9; Milestone 1 `Tasks 16–18` Complete)
- Email-first registration + simulated email OTP + optional phone (`Task 19`), two-step hybrid passport verification (`Task 20`), live `requireAuth` account suspension (`Task 21`).
- Employee `agent` role, Fixed-Location Offices vs. Individual Agents, Cash Exposure Limits, and in-app Agent Directory & Trust Verification (`Tasks 22–23`).
- Option B fixed-preset pending cash top-ups, Admin hand-in release, and cash shortage reconciliation (`Tasks 24–26`).
- External merchant onboarding, manual `Verified` status, API credentials, Hosted Checkout + configurable merchant fees, and centralized limits (`Tasks 12/27, 28, 29, 8`).
- Daily simulated Merchant CCP payouts (`Task 30`) and pre-departure Customer cash refunds (`Tasks 31–32`).
- Admin conservation/config backend (`Task 33`), 50-request stress & two-part conservation suite (`Task 34`), full React portals (`Tasks 13–14`), and demonstration external store integration (`Task 35`).

---

## Tech Stack

- **Backend:** Node.js (v20+), Express 4
- **Database:** PostgreSQL 16 (Docker), Drizzle ORM, `pg`, `drizzle-kit`
- **Frontend:** React 19, Vite 6, Tailwind CSS 4 (`src/client/App.jsx` placeholder card today)
- **Testing:** Vitest 3, Supertest 7 (`--no-file-parallelism`)
- **Containers & Auth:** Docker, Docker Compose, `bcryptjs`, `jsonwebtoken`, `cors`, `dotenv`

---

## How to Run Locally

### Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(PowerShell: `Copy-Item .env.example .env`)*

Configure database, JWT, and local admin seed environment variables in `.env` (never commit `.env` or hardcode admin passwords in docs):
- `PORT` (`3000`)
- `DATABASE_URL` (`postgres://postgres:postgres@localhost:5432/wallet_db`)
- `JWT_SECRET` (required strong random secret in `NODE_ENV=production` — server and auth reject missing/placeholder values cleanly)
- `DEMO_MODE` (`true` for local/demo OTP inspection; off by default in code)
- `ADMIN_PHONE` (or `ADMIN_EMAIL` once migrated in Task 19), `ADMIN_PASSWORD`, `ADMIN_NAME` — **required** explicit values read by `src/scripts/seed-admin.js` (zero hardcoded defaults)

### One-Command Docker Compose
```bash
docker compose up --build
```
Starts PostgreSQL, runs Drizzle migrations, runs `npm run seed:admin` idempotently using environment configuration, and serves the app on `http://localhost:3000`.

To start only PostgreSQL for local Node development:
```bash
docker compose up -d db
npm install
npm run dev
```

### Reviewer Walk-Through (Cohort Baseline v0 APIs Today)
```bash
# 1. Start the stack and verify health
docker compose up --build -d
curl http://localhost:3000/health

# 2. Log in as the admin account seeded from your environment configuration
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"<ADMIN_PHONE_OR_EMAIL>","password":"<ADMIN_PASSWORD>"}'

# 3. Register a merchant & verify simulated OTP (DEMO_MODE=true)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"0550987654","name":"Shop A","password":"<USER_PASSWORD>","role":"merchant"}'
curl http://localhost:3000/api/auth/otp/0550987654
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"0550987654","code":"<CODE>"}'

# 4. Inspect container logs for simulated OTP output
docker compose logs app | grep "OTP SIMULATOR"
```

---

## How to Run the Tests

Run the full automated real-PostgreSQL test suite:
```bash
npm test
```
Executes `vitest run --no-file-parallelism` across all **11 test files (155 passing tests** on `next-product`; **10 test files, 137 tests** in Cohort Baseline v0 on `main`) in `tests/` (including `tests/otp-demo-mode.test.js` and `tests/security-hardening.test.js`).

Run an individual test file:
```bash
npx vitest run tests/health.test.js
npx vitest run tests/payment-concurrency.test.js
```

---

## Project Structure

```text
project1-dtc/
├── _docs/                        # Product specs, backlog, process & role contracts
│   ├── plan.md                   # Blendinar product plan, rules (R1–R15) & checks (1–34)
│   ├── tasks.md                  # Historical Tasks 1–15 + Blendinar v1 Milestones 1–9
│   ├── process.md                # Source-of-truth hierarchy, 5-agent workflow & stop gates
│   ├── task-template.md          # 12-section grooming template
│   ├── testing-guidelines.md     # Real-DB concurrency, idempotency & conservation rules
│   ├── design-system.md          # Frontend trust cues, 3 balance states & accessibility
│   └── team/                     # orchestrator.md, pm.md, software-engineer.md, qa-engineer.md, reviewer.md
├── docs/                         # Plain-English engineering guides & ADRs (01–06 + README)
├── src/
│   ├── app.js                    # Express app setup and route mounting
│   ├── index.js                  # HTTP entrypoint & Vite/static frontend serving
│   ├── db/                       # PostgreSQL pool & Drizzle ORM schema (src/db/schema.js)
│   ├── middleware/               # JWT auth and role guards (src/middleware/auth.js)
│   ├── routes/                   # auth, customer, merchant, admin routes
│   ├── services/                 # otp, wallet, and payment business services
│   ├── scripts/                  # Idempotent admin seed script (src/scripts/seed-admin.js)
│   └── client/                   # React 19 + Vite 6 + Tailwind CSS 4 Blendinar simulated-money shell (App.jsx)
├── drizzle/                      # Forward-only SQL migrations
├── tests/                        # Real-PostgreSQL Vitest + Supertest suites (11 test files, 155 passing tests on next-product; 137 in Cohort v0 on main)
├── .github/workflows/ci.yml      # GitHub Actions CI pipeline
├── AGENTS.md                     # Repo-wide AI agent rules and commands
├── Dockerfile                    # Multi-step container build & startup
└── docker-compose.yml            # PostgreSQL + app orchestration
```

---

## Project Documentation

### Specifications & Team Workflow (`_docs/`)
- [`_docs/plan.md`](./_docs/plan.md) — Blendinar specification, decision classifications, business rules (`R1`–`R15`), Two-Part Conservation Invariant (`Proposed`), and Acceptance Checks (`1`–`34`).
- [`_docs/tasks.md`](./_docs/tasks.md) — Preserved Cohort v0 tasks (`1`–`15`) and ordered Blendinar v1 tasks across 9 milestones.
- [`_docs/process.md`](./_docs/process.md) — Source-of-truth hierarchy, 5-agent 10-step lifecycle, 3-failure escalation, and Milestone Stop Points.
- [`_docs/task-template.md`](./_docs/task-template.md) — 12-section task grooming template.
- [`_docs/testing-guidelines.md`](./_docs/testing-guidelines.md) — Real-PostgreSQL financial, concurrency, scoped idempotency, and conservation test rules.
- [`_docs/design-system.md`](./_docs/design-system.md) — UI rules, simulated-money banner, three-state balance separation, and Hosted Checkout trust elements.
- [`_docs/team/orchestrator.md`](./_docs/team/orchestrator.md), [`_docs/team/pm.md`](./_docs/team/pm.md), [`_docs/team/software-engineer.md`](./_docs/team/software-engineer.md), [`_docs/team/qa-engineer.md`](./_docs/team/qa-engineer.md), [`_docs/team/reviewer.md`](./_docs/team/reviewer.md) — Role boundaries and definitions of done.
- [`AGENTS.md`](./AGENTS.md) — Commands, currency/concurrency/migration rules, and document index.

### Engineering & Architecture Guides (`docs/`)
- [`docs/README.md`](./docs/README.md) and [`docs/01-system-architecture.md`](./docs/01-system-architecture.md) through [`docs/06-devops-testing-and-workflow.md`](./docs/06-devops-testing-and-workflow.md) — Architecture, schema, concurrency/idempotency, security, ADRs (`ADR-001`–`ADR-012`), and testing workflow.

---

## How AI Tools Were Used

Blendinar follows a **5-agent engineering workflow** defined in [`_docs/process.md`](./_docs/process.md):
1. **Orchestrator (`_docs/team/orchestrator.md`):** Coordinates task selection, model sizing, prevents conflicting concurrent writes, and enforces Lyna approval gates, Milestone Stop Points, and the 3-failure QA escalation rule.
2. **Product Manager (`_docs/team/pm.md`):** Grooms tasks into 12-section specs (`_docs/task-template.md`) preserving strict decision classifications (`Confirmed`, `Delegated`, `Proposed`, `Open`, `Future`, `Unverified`).
3. **Software Engineer (`_docs/team/software-engineer.md`):** Implements one groomed task at a time within `Constraints`, writes real-DB tests, and updates `docs/*.md` in scope.
4. **QA Engineer (`_docs/team/qa-engineer.md`):** Independently verifies running code, PostgreSQL invariants, and `npm test` execution (`## QA: PASS` / `## QA: FAIL`) without modifying files.
5. **Independent Reviewer (`_docs/team/reviewer.md`):** Audits sensitive financial, schema, auth, and architectural tasks before coding and after QA (`## REVIEW: APPROVE` / `## REVIEW: CHANGES REQUESTED`).

### Verified Progress Today
Cohort Baseline tasks `1`–`7` plus partial `9` and `15` are verified on `main` (**10 test files, 137 passing tests**). On **`next-product`**, **Milestone 1 (`Tasks 16–18`) is Complete** — **Task 16** (scoped `(user_id, endpoint, key)` idempotency, payload hashing, auth-before-replay, `pg_advisory_xact_lock`, and `MAX_SAFE_DINARS` overflow guard), **Task 17** (`main` + `next-product` CI coverage), and **Task 18** (fail-fast production `JWT_SECRET`, env-only `seed-admin.js`, and Blendinar starter shell) — with **11 test files and 155 passing tests** (`npm test`), while remaining Blendinar v1 features (`Tasks 8, 12/27, 13, 14, 19–35`) proceed sequentially through gated milestones.

---

## Continuous Integration & Deployment Guide (Not Deployed Yet)

- **CI (`.github/workflows/ci.yml`):** Runs PostgreSQL 16 migrations (`npx drizzle-kit migrate`), the full real-DB suite (`npm test` — **11 test files, 155 passing tests** on `next-product`; **137 tests** in Cohort Baseline v0 on `main`), and production build verification (`npm run build`) on pushes and pull requests to both **`main`** and **`next-product`**.
- **Hosting Status:** **Not deployed publicly yet.** `Dockerfile` builds the frontend, runs `npx drizzle-kit migrate && node src/scripts/seed-admin.js && node src/index.js`, and listens on `PORT` (`3000`).

### Render Deployment Environment Variables (Reference)
If deploying the container to Render or a similar Docker host, configure all secrets securely in the platform's Environment dashboard (never reuse dev defaults or hardcoded credentials):

| Variable | Value / Guidance |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DEMO_MODE` | `true` only for public fake-money demos needing simulated OTP visibility; unset/`false` otherwise |
| `DATABASE_URL` | Managed PostgreSQL internal connection string (`postgres://...`) |
| `JWT_SECRET` | Strong random secret (never use dev fallback) |
| `ADMIN_PHONE` / `ADMIN_EMAIL` | Initial admin identifier read by `src/scripts/seed-admin.js` (e.g., `<ADMIN_PHONE_OR_EMAIL>`) |
| `ADMIN_PASSWORD` | Strong admin password configured securely (`<ADMIN_PASSWORD>`) |
| `ADMIN_NAME` | Initial admin display name (e.g., `Platform Admin`) |

---

## Out of Scope / Future Features (Excluded from Blendinar v1)

Per [`_docs/plan.md`](./_docs/plan.md) Section 9, the following are explicitly excluded from Blendinar v1:

1. Custom / arbitrary cash top-up amounts outside centralized fixed presets (**Future**).
2. Automated passport scanning / OCR verification (**Future**).
3. National ID card verification beyond passports (**Future**).
4. Instagram-only merchants without a website and DM payment links (**Future**).
5. Automated customer-to-agent matching (**Future**).
6. In-app appointment scheduling with agents (**Future**).
7. International bank card top-ups (**Future**).
8. Customer bank or post cash deposits directly to Blendinar (**Future**).
9. Top-up Option A (agent prepaid float) and Option C (third-party partner settlement) (**Future**).
10. Agent commissions, bonuses, payroll, or salary management (**Confirmed** excluded).
11. Real bank, BaridiMob, or Algérie Poste CCP API integrations (**Future**).
12. Multi-currency wallets, FX conversion, or international/post-departure bank refunds (**Future**).
13. Customer-to-customer peer transfers (`R10`, subject to `O-11`), Admin erroneous-transaction reversals (`R11`), Support-agent role, and Arabic/French UI localization (**Future**).
14. **AI Assistant / AI Milestone:** **Explicitly Dropped** (neither active backlog nor postponed to a future release).
