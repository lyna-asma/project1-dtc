## Goal

One or two crisp sentences describing what must be true in the running system (and docs) when this task is complete.

## In plain words

A non-technical, plain-English explanation for Lyna summarizing why this task exists, who uses it, and what changes from a user's perspective.

## Product plan rules & requirements

- Reference exact rules, classifications (`Confirmed`, `Delegated`, `Proposed`, `Open`, `Future`, `Unverified`), and acceptance checks from `_docs/plan.md` (and relevant ADRs in `docs/05-design-patterns-and-adrs.md`).

## User scenarios

### Happy-path scenario (with realistic DZD numbers)
- Step-by-step walkthrough using concrete whole-Dinar numbers (e.g., customer starts with `0 DZD`, deposits `5,000 DZD` via fixed-location agent, sees `5,000 DZD` as *Pending (Not yet spendable)* until Admin confirms hand-in, then pays `2,000 DZD` at a merchant with `0 DZD` customer fee).

### Failure / edge-case scenario(s) (with realistic DZD numbers)
- Concrete negative scenario (e.g., customer attempts a `2,000 DZD` payment while `5,000 DZD` is still pending hand-in -> rejected with clear error; or agent hands in `10,000 DZD` against `15,000 DZD` collected -> shortage flagged without crediting unconfirmed cash).

## Acceptance criteria

Every criterion must be concrete, binary (pass/fail), and verifiable against HTTP responses, UI screens, or PostgreSQL rows. Never use vague phrases like "works properly" or "handles errors gracefully".

- [ ] **Happy path:** Exact inputs, expected HTTP status (`200`/`201`), response payload fields, UI display, and database state.
- [ ] **State transitions & invalid transition rejections:** Allowed transitions enumerated explicitly; invalid/duplicate/expired transitions rejected with exact HTTP status (`400`/`409`) and zero balance/ledger changes.
- [ ] **Auth, RBAC & account suspension negative cases:** Unauthenticated (`401`), wrong role (`403` across `customer`/`agent`/`merchant`/`admin`), cross-user isolation (`403`), and suspended-account rejection while preserving existing balances and history.
- [ ] **Boundary values & integer centime precision:** Reject `0`, negative numbers, decimals/non-integers, non-numeric strings, and amounts exceeding `Math.floor(Number.MAX_SAFE_INTEGER / 100)` (or configured limits / explicit `Open` `O-*` placeholder note); verify `dinars * 100` integer centime storage.
- [ ] **Concurrency & scoped idempotency:** Specify `Promise.all` race behavior (deterministic `SELECT ... FOR UPDATE` ordering) and scoped idempotency `(user_id, endpoint, key)` including payload mismatch rejection and auth/password check executing **before** cached replay.
- [ ] **Financial conservation & append-only ledger invariants:** Verify `transactions` rows are insert-only (never updated/deleted) and money/cash conservation equations hold after completion and mid-transaction failure rollback.

## Out of scope

- Explicit item deferred from this task, linked to `#TASK-NUMBER` (or milestone/future backlog item in `_docs/tasks.md`).

## Dependencies

- Prerequisite task IDs (`#TASK-NUMBER`) or `None`.

## Relevant existing implementation or files

- Exact existing file paths and key symbols to inspect or extend (e.g., `src/db/schema.js`, `src/services/wallet.js`, `src/middleware/auth.js`).

## Constraints

- **Allowed files:** Exact paths/directories this task may create or modify.
- **Libraries to use:** Only dependencies already in `package.json` (do not add packages without Lyna's explicit approval).
- **Guidelines to follow:** `AGENTS.md`, `_docs/process.md`, `_docs/testing-guidelines.md`, and `_docs/design-system.md` (if UI).
- **Database migrations:** Forward-only migrations only (`npx drizzle-kit generate`); **never** edit existing migration files in `drizzle/`.
- **Safeguards:** No hardcoded default admin credentials, secrets, or PII; keep simulated-money notices intact.

## Documentation & diagrams to update

- Exact guides (`docs/01-*` through `docs/06-*`, `docs/README.md`) or Mermaid diagrams (architecture, ERD, sequence, state) that must be updated in scope before QA. Write `None` only if no docs/diagrams are affected.

## Testing expectations

- Exact automated real-DB test types required (unit/validation, HTTP route integration, `Promise.all` concurrency race, fault-injection rollback via `_testFailureAfterBalanceUpdate`, scoped idempotency, negative RBAC/suspension, conservation invariant) and expectation that full `npm test` passes with zero skipped or relaxed assertions.

## Open owner decisions

- `None` — OR list specific blocking `O-*` IDs from `_docs/plan.md` / unapproved `Proposed` items that **must** be decided by Lyna before implementation starts.
