# 06 — DevOps, Testing Strategy & Agentic Engineering Workflow

## 1. Automated Testing: Proving Everything Against Real PostgreSQL

Rather than mocking the database, Blendinar runs all **11 test files** in [`tests/`](../tests/) (**155 automated tests** verified on `next-product`; **10 test files, 137 tests** in Cohort Baseline v0 on `main`) against a **real PostgreSQL 16 database** via **Vitest** and **Supertest** (`npm test` -> `vitest run --no-file-parallelism`).

| Test File | Cohort v0 (`main`) | Active (`next-product`) | What It Proves Today |
| :--- | :---: | :---: | :--- |
| `tests/health.test.js` | 2 | 2 | Server boots cleanly and `/health` + `/api/health` respond `{"status":"ok"}`. |
| `tests/auth-register.test.js` | 16 | 16 | Phone format rules, duplicate blocking, simulated OTP creation & verification. |
| `tests/otp-demo-mode.test.js` | 4 | 4 | `isOtpExposed()` hides simulated OTP logs and HTTP endpoint in production unless `DEMO_MODE=true`. |
| `tests/auth-login.test.js` | 6 | 6 | `bcrypt` password verification, unverified user blocking, and JWT issuance. |
| `tests/rbac.test.js` | 15 | 15 | Missing/invalid token `401`, role/resource isolation `403`, and env-explicit admin seeding (`seedAdmin`). |
| `tests/wallet-ledger.test.js` | 18 | 18 | Zero-balance initialization, centime math, and private chronological customer ledger. |
| `tests/admin-load.test.js` | 23 | 24 | Admin loading funds into a shop, input boundaries, `MAX_SAFE_DINARS` overflow guard (Task 16), and crash-rollback proof. |
| `tests/merchant-topup.test.js` | 27 | 28 | Shop crediting customer wallet, insufficient shop funds rejection, `MAX_SAFE_DINARS` overflow guard (Task 16), and rollback proof. |
| `tests/payment.test.js` | 23 | 24 | 5-min payment codes, password checks, expiration, `MAX_SAFE_DINARS` overflow guard (Task 16), and rollback proof. |
| `tests/payment-concurrency.test.js` | 3 | 11 | Dual simultaneous `800 DA` race, conservation, and Task 16 scoped `(user_id, endpoint, key)` idempotency, password-before-replay, `409` mismatch & advisory-lock race proofs. |
| `tests/security-hardening.test.js` | 0 | 7 | Task 18 fail-fast production `JWT_SECRET` enforcement (`getJwtSecret`, `requireAuth`, `startServer`) and env-only `seedAdmin` hardening. |
| **Total Verified Tests** | **137 (10 files)** | **155 (11 files)** | **All suites passing with `--no-file-parallelism` (`_docs/testing-guidelines.md`)** |

### Crash-Simulation Testing (**Fault Injection**)
To prove mid-transaction failures never leave half-finished money movements:
* Non-production routes pass `_testFailureAfterBalanceUpdate` into [`src/services/wallet.js`](../src/services/wallet.js) and [`src/services/payment.js`](../src/services/payment.js).
* In production (`NODE_ENV === 'production'`), routes force `_testFailureAfterBalanceUpdate` to `false`.
* When triggered in tests, PostgreSQL automatically rolls back balance updates so balances and ledger rows remain untouched.

---

## 2. One-Command Startup with Docker (`docker-compose.yml` & `Dockerfile`)

**Docker** packages Node.js, built React assets, and PostgreSQL 16 into reproducible containers started via `docker compose up --build`:

```mermaid
flowchart LR
    DB["PostgreSQL 16 Container"] -->|"Healthy DB ready"| AppStart["App Container (Node 20)"]
    subgraph Build_Time ["Step 1: Image Build (Dockerfile)"]
        NPM["npm install"] --> ViteBuild["npm run build (Compiles React to dist/)"]
    end
    subgraph Startup_CMD ["Step 2: Container Entrypoint"]
        Migrate["drizzle-kit migrate (Forward-only SQL tables)"] --> Seed["seed-admin.js (Env-configured admin seed)"] --> Serve["node src/index.js (Port 3000)"]
    end
    AppStart --> Migrate
```

* **Idempotent Admin Seeding ([`src/scripts/seed-admin.js`](../src/scripts/seed-admin.js)):** Safe to run repeatedly on container boot without duplicating the admin account.
* **Credential & Production Secret Hardening (`Task 18` Implemented):** `seed-admin.js` requires explicit non-empty `ADMIN_PHONE` and `ADMIN_PASSWORD` (no hardcoded fallbacks in code, `docker-compose.yml`, `.env.example`, or docs). In `NODE_ENV === 'production'`, `getJwtSecret()` (`src/middleware/auth.js`) and `startServer()` (`src/index.js`) fail loudly before listening if `JWT_SECRET` is missing, blank, or matches a legacy placeholder. Configure credentials via `.env` or your host secret manager (`ADMIN_PHONE` / `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `JWT_SECRET`).

---

## 3. Continuous Integration (`.github/workflows/ci.yml`)

GitHub Actions runs on pushes and pull requests to both **`main`** and **`next-product`**:
1. Starts PostgreSQL 16 with healthchecks.
2. Runs `npm ci`.
3. Applies migrations (`npx drizzle-kit migrate`).
4. Runs the full real-DB suite (`npm test` — **11 test files / 155 automated tests** verified on `next-product`; **10 files / 137 tests** in Cohort Baseline v0 on `main`).
5. Verifies the Vite production frontend build (`npm run build`).

---

## 4. Blendinar 5-Agent Engineering Workflow ([`_docs/process.md`](../_docs/process.md))

Blendinar uses a structured **5-agent team** with strict role boundaries, pre/post review gates, Lyna approval gates, a **3-failure QA escalation rule**, and **Milestone Stop Points**:

```mermaid
flowchart LR
    Backlog["1. Orchestrator picks task (_docs/tasks.md)"] --> PM["2. PM grooms 12-section spec (_docs/task-template.md)"]
    PM --> PreRev["3. Reviewer pre-check (Sensitive tasks)"]
    PreRev --> Gate["4. Lyna Approval Gate (Open O-* or Milestone)"]
    Gate --> Eng["5. Software Engineer codes, tests & updates docs"]
    Eng --> QA["6. QA Engineer verifies via npm test (No edits)"]
    QA -->|"FAIL (< 3 rounds)"| Eng
    QA -->|"FAIL (3 rounds)"| Escalate["Escalate to Lyna"]
    QA -->|"PASS"| PostRev["7. Reviewer post-QA gate"]
    PostRev -->|"CHANGES REQUESTED"| Eng
    PostRev -->|"APPROVE"| Close["8. Orchestrator closes task & checks Stop Points"]
```

---

## 5. Current Baseline vs. Blendinar v1 Roadmap

The Cohort Baseline v0 backend, concurrency proof, Docker packaging, and CI pipeline on `main` are verified (**10 test files, 137 tests**). On **`next-product`**, **Milestone 1 (`Tasks 16–18`) is Complete** (**11 test files, 155 passing automated tests**, `npm run build` verified); remaining Blendinar v1 work continues across **Milestones 2–9** documented in [`_docs/plan.md`](../_docs/plan.md) and [`_docs/tasks.md`](../_docs/tasks.md):
1. **M1 (`Complete`):** Scoped idempotency `(user_id, endpoint, key)` + auth-before-replay + overflow guard (`Task 16`, **Completed**), `next-product` CI (`Task 17`, **Completed**), and fail-fast secret/seed hardening & simulated-money branding (`Task 18`, **Completed**).
2. **M2:** Email-first auth + simulated email OTP + optional phone (`Task 19`), two-step hybrid passport verification (`Task 20`), and live account suspension preserving balances (`Task 21`).
3. **M3:** Employee `agent` role, Fixed-Location Offices vs. Individual Agents, Cash Exposure Limits (`Task 22`), and customer Agent Directory + in-app verification (`Task 23`).
4. **M4 (`[Stop Point]`):** Option B fixed-preset pending top-ups (`Task 24`), Admin hand-in release (`Task 25`), and shortage/discrepancy audit flags (`Task 26`).
5. **M5:** External merchant website/CCP onboarding & manual verification (`Task 12 / Task 27`), API keys & Hosted Checkout session backend (`Task 28`).
6. **M6 (`[Stop Point]`):** Hosted Checkout payment with configurable merchant fee & `0` customer fee (`Task 29`) and centralized limits (`Task 8`).
7. **M7 (`[Stop Point]`):** Daily Merchant CCP Payout batches, Admin simulated settlement & exception states (`Task 30`).
8. **M8 (`[Stop Point]`):** Pre-departure customer cash refund locks (`Task 31`) and Agent passport check & cash disbursement (`Task 32`).
9. **M9 (`[Stop Points per Frontend Area]`):** Admin config/conservation APIs (`Task 33`), 50-request stress & two-part conservation suite (`Task 34`), Customer/Hosted Checkout UI (`Task 13`), Agent/Merchant/Admin portals (`Task 14`), and demonstration external store integration (`Task 35`).

*(Deferred to **Future**: P2P transfers `R10` subject to `O-11`, Admin reversals `R11`, public URL deployment, real bank/CCP/SMS/email/OCR APIs, Arabic/French UI. The **AI Milestone** is explicitly **Dropped**.)*
