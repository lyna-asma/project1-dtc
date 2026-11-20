# AGENTS.md

## Project Overview

**Blendinar — Simulated Digital Wallet and Online Merchant Payment Platform** (evolved from the AI Dev Tools Zoomcamp 2026 Cohort Baseline).
Read `_docs/plan.md` for business rules, decision classifications, and acceptance checks, and `_docs/tasks.md` for the task backlog.

> **Baseline vs. Blendinar Target Note:** The current `src/` codebase reflects the Cohort Baseline v0 (3 roles, phone OTP, shop-float cash top-ups, 6-character payment codes, **10 test files / 137 automated tests**, and a placeholder starter card in `src/client/App.jsx`). New Blendinar capabilities (4 roles including employee Agents, email + simulated email OTP, passport-only KYC, Option B cash top-up hand-ins, hosted external merchant checkout with configurable merchant fees, daily CCP payouts, customer cash refunds, and full React portals) are governed by `_docs/plan.md` and executed one groomed task at a time per `_docs/process.md`.

## Tech Stack

- **Backend:** Node.js + Express (layered monolith: `src/routes/` -> `src/middleware/` -> `src/services/` -> `src/db/`)
- **Database:** PostgreSQL + Drizzle ORM (`drizzle-kit` for forward-only migrations)
- **Frontend:** React 19 + Vite 6 + Tailwind CSS 4 (`src/client/App.jsx` placeholder card currently; full Blendinar UI planned per `_docs/design-system.md`)
- **Testing:** Vitest + Supertest against real PostgreSQL (`--no-file-parallelism`)
- **Containers:** Docker Compose

## Commands

- `npm install` - install dependencies
- `docker compose up -d db` - start local PostgreSQL container
- `npm test` - run the full automated test suite
- `npx vitest run tests/health.test.js` - run a single test file
- `npx drizzle-kit generate` - generate SQL migrations from the Drizzle schema
- `npx drizzle-kit migrate` - apply SQL migrations to PostgreSQL
- `npm run dev` - start the development server

## Rules

- **Dependencies:** Defined in `package.json`. Do not add new packages without asking Lyna first.
- **Currency & Amounts:** Input and display use whole Algerian Dinars (DZD). Store all balances and monetary amounts in PostgreSQL as integer centimes (`bigint`, `dinars * 100`). Never use floating-point numbers for money, and reject `amountDinars > Math.floor(Number.MAX_SAFE_INTEGER / 100)` to prevent integer overflow.
- **No Negative Balances & Concurrency:** A wallet or payable balance must never go below zero (`CHECK (balance >= 0)`). Check balances/states and mutate atomically in a single database transaction using deterministic row-level locking (`SELECT ... FOR UPDATE` sorted by ascending row ID).
- **Append-Only Ledger:** Transaction history rows are only ever added; never update or delete existing ledger rows. Reversals or adjustments append a new offsetting row.
- **Option B Cash Top-Ups (Blendinar v1):** Agent-collected cash top-ups remain **Pending (Not Yet Spendable)** until an Administrator confirms the employee Agent's cash hand-in; only then is the customer's spendable balance credited.
- **Centralized Configurable Limits & Merchant Fees:** Keep limits (fixed top-up presets, customer limits, unverified merchant limits, agent cash-exposure caps) and configurable merchant fee rules in centralized configuration; customers pay `0` fees on top-ups, payments, and refunds in v1.
- **Simulated Email OTP (`DEMO_MODE`):** Keep one-time verification code delivery behind a single replaceable function (`sendOtp` in `src/services/otp.js`) preserving `DEMO_MODE` for local review and automated tests without real email/SMS delivery. *(Cohort v0 currently uses phone OTP; Blendinar v1 transitions to required email + optional phone.)*
- **Testing & Repository Safeguards:** Every feature must have automated real-DB tests covering acceptance checks in `_docs/plan.md` and `_docs/testing-guidelines.md`. Use forward-only migrations only (never edit existing files in `drizzle/`); never push directly to `main` or alter the submitted cohort baseline; never publish hardcoded default admin passwords, credentials, or PII in docs or code; keep the simulated-money notice visible across docs and UI.

## Documents

Read a file only if it exists. Do not invent contents for missing files, and do not create undocumented specs unless a task asks for them.

- `_docs/plan.md` - product specification, decision classifications, business rules, and acceptance checks
- `_docs/tasks.md` - task backlog and milestone schedule
- `_docs/process.md` - source-of-truth hierarchy, 5-agent workflow, 10-step lifecycle, stop gates, and safeguards
- `_docs/task-template.md` - 12-section grooming template
- `_docs/testing-guidelines.md` - real-DB testing rules, concurrency, scoped idempotency, and conservation invariants
- `_docs/design-system.md` - frontend UI, trust cues, three-state balance separation, and accessibility rules
- `_docs/team/orchestrator.md` - Orchestrator role
- `_docs/team/pm.md` - Product Manager role
- `_docs/team/software-engineer.md` - Software Engineer role
- `_docs/team/qa-engineer.md` - QA Engineer role
- `_docs/team/reviewer.md` - Independent Reviewer role
- `docs/README.md` (and `docs/01-*` through `docs/06-*`) - engineering architecture guides and ADRs
