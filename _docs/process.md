# Development Process

This document describes how work is organized and executed in this project.

## Documents

This section lists project documents that may be useful. Some of them exist already and some will only be created later.

- Only read a file if it exists.
- If a file is missing, do not search for it, do not guess what it contains, and do not create it unless a task asks you to.

- `_docs/plan.md` - product specification, business rules, and acceptance criteria
- `_docs/tasks.md` - task backlog
- `_docs/process.md` - how work is organized
- `_docs/testing-guidelines.md` - read before writing tests (may not exist yet)
- `_docs/design-system.md` - read for anything touching the UI (may not exist yet)
- ` _docs/team/pm` - see its role in roles section 

## How Work is Organized

1. **One Task at a Time:** Work is tracked in GitHub Issues (mirrored from `_docs/tasks.md`). Each session focuses on completing a single task end-to-end.
2. **Check Context First:** Before starting a task, read `AGENTS.md`, `_docs/plan.md`, and any existing relevant documents in `_docs/` (such as `_docs/testing-guidelines.md` when writing tests or `_docs/design-system.md` when working on the UI, if they exist).
3. **Implement & Test:** Write the implementation along with automated tests that prove the acceptance checks in `_docs/plan.md`.
4. **Verify Before Finishing:** Run `npm test` to confirm the entire test suite passes with zero regressions before committing, pushing, and closing the GitHub issue.

## Roles

- PM - grooms a task before anyone implements it, follows ` _docs/team/pm`.md