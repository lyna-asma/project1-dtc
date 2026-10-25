# AGENTS.md

## Project Overview

Digital Wallet and Merchant Payment Platform (AI Dev Tools Zoomcamp 2026).
Read `_docs/plan.md` for business rules and acceptance criteria, and `_docs/tasks.md` for the task backlog.

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** PostgreSQL + Drizzle ORM (`drizzle-kit` for migrations)
- **Frontend:** React + Vite + Tailwind CSS
- **Testing:** Vitest + Supertest
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

- Dependencies are defined in `package.json`. Do not add new packages without asking first.
- **Currency & Amounts:** Input is whole Algerian Dinars (DZD). Store all balances and transaction amounts in the database as integer centimes (`dinars * 100`). Never use floating-point numbers for money.
- **No Negative Balances:** A wallet balance must never go below zero (`CHECK (balance >= 0)`). Check balance and deduct atomically in a single database transaction using row-level locking (`SELECT ... FOR UPDATE`).
- **Append-Only Ledger:** Transaction history rows are only ever added; never update or delete existing ledger rows. Reversals add a new offsetting transaction and mark the original as reversed.
- **Centralized Limits:** Keep the three customer limits (50,000 DA per transaction, 100,000 DA per customer per day, 200,000 DA max customer wallet balance) in one central configuration file.
- **Simulated OTP:** Keep one-time code sending behind a single replaceable function that logs/exposes codes for local review and automated tests without sending real SMS.
- **Testing:** Every feature must have automated tests covering its acceptance checks in `_docs/plan.md`.

## Documents

This section lists project documents that may be useful. Some of them exist already and some will only be created later.

- Only read a file if it exists.
- If a file is missing, do not search for it, do not guess what it contains, and do not create it unless a task asks you to.

- `_docs/plan.md` - product specification, business rules, and acceptance criteria
- `_docs/tasks.md` - task backlog
- `_docs/process.md` - how work is organized
- `_docs/testing-guidelines.md` - read before writing tests (may not exist yet)
- `_docs/design-system.md` - read for anything touching the UI (may not exist yet)


