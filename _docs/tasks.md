# Backlog Tasks: Wallet and Merchant Payment Platform

## 1. Empty project setup with a passing test
Goal: Initialize the Node.js backend, React frontend scaffold, PostgreSQL container, and a passing test.
Description: Set up the project workspace with Express, Drizzle ORM, Vitest, and a base `docker-compose.yml` running PostgreSQL. Create a `/health` API endpoint and a single-command test script (`npm test`) that verifies the server starts and responds properly.

## 2. User sign-up and simulated OTP verification
Goal: Allow customers and merchants to register with a phone number, display name, password, and simulated SMS code.
Description: Create the `users` and `otp_codes` database tables storing phone numbers, registered names (customer name or shop name), hashed passwords, roles (`customer`, `merchant`, `admin`), and verification state. Generate a 6-digit one-time code sent behind a single pluggable function that logs the code and exposes it in test/dev mode so reviewers and automated tests can read it without real SMS. Reject duplicate phone numbers or wrong codes, and automatically initialize a zero-balance wallet upon verification.

## 3. Login, token authentication, and role-based access control
Goal: Issue authentication tokens on login and enforce role permissions across customer, merchant, and admin routes.
Description: Build a login endpoint that verifies a phone number and password against stored hashes and returns a signed token. Create authentication and role-guard middleware restricting endpoints to `customer`, `merchant`, or `admin` so non-admins cannot use admin actions and users cannot access others' data. Include a setup script that seeds the initial admin account.

## 4. Wallet schema, append-only ledger, and customer history
Goal: Implement centime-based wallets, an immutable transaction ledger, and the customer balance and history endpoint.
Description: Define `wallets` and `transactions` tables in PostgreSQL storing all monetary values as integer centimes (`dinars * 100`) with a database `CHECK (balance >= 0)` constraint and extensible fields so fees can be added later. Enforce an append-only ledger where lines are only ever added and never edited or deleted. Build endpoints for an authenticated customer to view their own balance and transaction history while blocking access to any other customer's history.

## 5. Admin shop balance loading
Goal: Allow an admin to load money into a merchant's shop balance and record it in the ledger.
Description: Build an admin-only endpoint that accepts a merchant identifier and a positive whole-dinar amount, converts it to centimes, and credits the shop's wallet inside an atomic database transaction. Append a corresponding ledger entry so every dinar entering the platform is tracked. Verify with automated tests that non-admins are rejected and the sum of all wallet balances equals the total loaded by the admin.

## 6. Merchant cash top-up to customer wallet
Goal: Enable a merchant to credit a customer's wallet with cash by deducting from the shop's own balance.
Description: Create a merchant endpoint accepting a customer's phone number and a whole-dinar top-up amount. Inside an atomic database transaction with row-level locking (`SELECT ... FOR UPDATE`), verify the shop has enough balance, lower the shop balance, raise the customer balance by the same amount, and create history lines visible to both parties. Reject any top-up larger than the shop balance with no state changes.

## 7. Merchant payment code generation and customer confirmation
Goal: Allow a merchant to generate a 5-minute single-use payment code and a customer to confirm payment with their password.
Description: Create a `payment_requests` table and a merchant endpoint that takes a whole-dinar amount and generates a single-use payment code expiring after 5 minutes. Provide a lookup endpoint for the customer to inspect the shop name and exact amount from the code, and a confirmation endpoint requiring the customer's password. When the password and balance are valid, atomically lower the customer balance, raise the shop balance, mark the code used, and record the ledger transaction; if the password is wrong or balance is insufficient, move no money.

## 8. Transaction, daily spending, and wallet balance limits (Planned for a future version)
Goal: Enforce the three platform financial limits defined in a single central configuration file (planned for a future version).
Description: Create one central configuration file holding the three limits: maximum 50,000 DA per transaction, maximum 100,000 DA per customer per day, and maximum balance of 200,000 DA per customer wallet. Integrate a validation module that checks individual transaction amounts, sums a customer's daily outgoing totals, and verifies that top-ups or incoming funds never push a customer wallet above 200,000 DA. Reject any operation that breaches a limit with a clear error message and leave balances unchanged.

## 9. Idempotency keys and concurrency stress test suite
Goal: Guarantee safety under simultaneous requests and prevent duplicate charges on repeated submissions (payment confirmation idempotency and dual payment concurrency test completed; general transfer idempotency and 50-request stress test planned for a future version).
Description: Add an `idempotency_keys` table and middleware that tracks request identifiers on confirmation and transfer endpoints so sending the same request twice charges once and returns the original response. Use deterministic row-lock ordering (`SELECT ... FOR UPDATE` sorted by wallet ID) to prevent deadlocks and race conditions. Write an automated concurrency test suite running 50 simultaneous requests, proving that two simultaneous 800 DA payments from a 1,000 DA balance let exactly one succeed (leaving 200 DA) and that the sum of all customer and shop balances always equals the total loaded by the admin.

## 10. Customer-to-customer transfer with recipient name preview (Planned for a future version)
Goal: Allow a customer to look up another customer by phone number, verify their registered name, and send money immediately (planned for a future version).
Description: Build a recipient lookup endpoint that resolves a phone number to the registered customer's name and rejects unknown phone numbers. Create a transfer endpoint where the sender confirms with their password to move whole dinars immediately without recipient approval. Enforce password verification, balance sufficiency, and all three customer limits inside an atomic, lock-ordered database transaction.

## 11. Admin transaction reversal (Planned for a future version)
Goal: Allow an admin to reverse a completed transaction by appending an offsetting transaction to the ledger (planned for a future version).
Description: Build an admin-only reversal endpoint that locks the original transaction and both wallets inside an atomic database transaction. Reject the reversal if the transaction was already reversed or if the original receiver has spent the funds and cannot cover the amount without going below zero. Otherwise, move the money back by appending a new reversal ledger transaction and marking the original transaction as reversed.

## 12. Admin shop approval and merchant history view (Planned for a future version)
Goal: Require admin approval before a merchant can operate and provide a dedicated shop history and status endpoint (planned for a future version).
Description: Build admin endpoints to list merchants and approve shops, and enforce a check ensuring unapproved shops cannot perform cash top-ups or generate payment codes. Create a merchant endpoint returning the shop's approval status, current balance, and chronological transaction history. Add automated tests verifying shop approval enforcement and history isolation.

## 13. React frontend for the customer journey (Planned for a future version)
Goal: Build the customer web interface for sign-up, balance, history, shop payment confirmation, and peer transfers (scaffold in place; full customer journey UI is planned for a future version).
Description: Create a React + Vite + Tailwind CSS interface covering customer sign-up (with simulated OTP display/entry), login, wallet balance in DZD, and transaction history. Build the payment flow where a customer enters a payment code, sees the shop name and amount, and confirms with their password, alongside the peer transfer flow showing the recipient's registered name before confirmation. Surface clear validation messages for wrong passwords, insufficient balances, or exceeded limits.

## 14. React frontend for merchant and admin portals (Planned for a future version)
Goal: Build the web interfaces for merchant cash top-ups, payment code creation, and admin platform controls (scaffold in place; full merchant/admin portals UI is planned for a future version).
Description: Build the merchant view displaying shop balance, approval status, a cash top-up form (customer phone number and amount), and a payment request generator showing the 5-minute code. Build the admin dashboard to approve shops, load money into shop balances, inspect all platform transactions, and trigger transaction reversals. Include a convenient role/account switcher or simulated OTP viewer screen so reviewers can test all flows effortlessly.

## 15. One-command Docker Compose, CI pipeline, and public deployment
Goal: Package the full application for one-command local execution, automated GitHub Actions CI, and public hosting (Docker Compose packaging and GitHub Actions CI workflow completed; deployment to a public URL is planned for a future version).
Description: Finalize Dockerfiles and `docker-compose.yml` so one command starts PostgreSQL, runs migrations, seeds the initial admin account, and serves the application. Configure a GitHub Actions workflow that runs the entire acceptance and concurrency test suite on every push and pull request. Deploying the application to a public URL (such as Render or Fly.io) is planned for a future version; a step-by-step Render deployment guide is documented in the README "Deployment" section (not deployed yet). Write a comprehensive `README.md` covering setup, architecture, and test execution.
