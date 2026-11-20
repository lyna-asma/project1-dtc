# 03 — Concurrency Control, Deadlock Prevention & Idempotency

One of the hardest problems in financial software is **concurrency**—what happens when two requests hit the server at the exact same millisecond. This guide explains the concurrency shields built into Cohort Baseline v0 and the upgraded state machines and race protections planned for Blendinar v1.

---

## 1. Stopping "Double Spending" with Row Locks (Implemented Today)

If a customer has **1,000 DA** and two **800 DA** payment requests arrive simultaneously, without database locking both requests could read `1,000 DA`, both pass the check, and both subtract `800 DA`. That bug is a **race condition**.

### Solution: Pessimistic Row-Level Locking (`SELECT ... FOR UPDATE`)
* **Transaction (`db.transaction`):** An all-or-nothing database bundle.
* **Row-Level Lock (`.for('update')`):** Tells PostgreSQL: *"Lock this exact row now; make concurrent transactions wait until mine commits or rolls back."*

```mermaid
sequenceDiagram
    autonumber
    participant ReqA as Request A (Pay 800 DA)
    participant ReqB as Request B (Pay 800 DA)
    participant PG as PostgreSQL (Wallet = 1,000 DA)

    par Both arrive at the same millisecond
        ReqA->>PG: Start Transaction
        ReqB->>PG: Start Transaction
    end

    ReqA->>PG: Lock Customer Wallet (FOR UPDATE)
    ReqB->>PG: Lock Customer Wallet (FOR UPDATE) - waits
    PG-->>ReqA: Lock granted (Balance = 1,000 DA)

    ReqA->>PG: Deduct 800 DA (Balance = 200 DA)
    ReqA->>PG: Mark payment completed and append ledger row
    ReqA->>PG: Commit and release lock
    PG-->>ReqA: 200 OK (200 DA remaining)

    PG-->>ReqB: Lock granted (Sees Balance = 200 DA)
    ReqB->>ReqB: Check 200 DA < 800 DA -> Insufficient
    ReqB->>PG: Rollback transaction
    PG-->>ReqB: 400 Error (Insufficient balance)
```

---

## 2. Deadlock Prevention via Deterministic Lock Ordering (Implemented Today)

A **deadlock** occurs when Transaction 1 holds Wallet A and waits for Wallet B while Transaction 2 holds Wallet B and waits for Wallet A.

Both [`src/services/wallet.js`](../src/services/wallet.js) and [`src/services/payment.js`](../src/services/payment.js) prevent deadlocks by sorting wallet IDs from smallest to largest before calling `.for('update')`:

```javascript
const walletIdsInOrder = [customerWallet.id, merchantWallet.id].sort((a, b) => a - b);
```

Every Blendinar v1 multi-row transaction extends this exact ascending lock-ordering pattern across wallets, top-ups, hand-in batches, checkout sessions, payout rows, and refund requests.

---

## 3. Baseline Single-Use Payment Codes & State Machine (Cohort v0)

In [`src/services/payment.js`](../src/services/payment.js), Cohort v0 payment codes use **Lock-Before-Mutate** (`FOR UPDATE` on `payment_requests`), **Lazy Expiration** (`now > expiresAt`), and human-friendly 6-character codes:

```mermaid
stateDiagram-v2
    [*] --> pending : Merchant creates 6-char code (5 min TTL)
    pending --> completed : Customer confirms with password and balance
    pending --> expired : Clock past expiresAt on lookup or confirm
    completed --> [*] : Cannot be reused
    expired --> [*] : Rejected with 400
```

---

## 4. Idempotency Keys: Verified Baseline Behavior & Task 16 Fixes

**Idempotency** ensures that if a client retries the exact same request (e.g., mobile network drop), the financial mutation runs **at most once** and returns the original receipt.

### Three Verified Findings in Cohort Baseline v0 (`src/db/schema.js` & `src/services/payment.js`)
Inspecting the current baseline implementation reveals three concrete limitations that **Task 16** in [`_docs/tasks.md`](../_docs/tasks.md) explicitly fixes:
1. **Global `key` Uniqueness Collision:** `idempotency_keys.key` in [`src/db/schema.js`](../src/db/schema.js) has a global `.unique()` index rather than composite `(user_id, endpoint, key)` scoping, so two different users sending the same generic key string collide on insert.
2. **Pre-Transaction TOCTOU Race Window:** In `confirmPaymentRequest` ([`src/services/payment.js`](../src/services/payment.js)), the `idempotency_keys` lookup executes *before* `db.transaction(...)` starts, allowing two identical-key requests arriving at the same millisecond to race past the read check before the first inserts its key.
3. **Idempotency Lookup Runs Before Password Check:** In `confirmPaymentRequest` today, the cached `idempotency_keys` lookup executes at the top of the function *before* `bcrypt.compare(password, ...)`. In Blendinar (**Task 16** & `R12-B`), **authentication, live account suspension check, and password verification MUST execute BEFORE returning any cached idempotent response**, and payload mismatches (`request_hash`) must be rejected (`409`/`422`).

---

## 5. Blendinar v1 Concurrency Sequences & State Machines *(Planned in `_docs/tasks.md`)*

### 5.1 Option B Top-Up & Admin Hand-In State Machine + Double-Confirm Protection

```mermaid
stateDiagram-v2
    [*] --> pending_hand_in : Agent records fixed-preset cash collection
    pending_hand_in --> confirmed : Admin confirms full cash hand-in (Credits Spendable)
    pending_hand_in --> shortage_hold : Admin receives less cash than collected (O-05)
    pending_hand_in --> disputed : Admin or audit flags discrepancy
    shortage_hold --> confirmed : Admin reconciles shortage and releases approved portion
    shortage_hold --> disputed : Escalated dispute
```

```mermaid
sequenceDiagram
    autonumber
    actor AdminA as Admin 1
    actor AdminB as Admin 2
    participant API as Hand-In Service
    participant DB as PostgreSQL

    par Concurrent hand-in confirmation
        AdminA->>API: POST confirm hand-in #42
        AdminB->>API: POST confirm hand-in #42
    end
    API->>DB: Transaction A locks hand_in #42 + top_ups + wallets (FOR UPDATE)
    API->>DB: Transaction B waits on hand_in #42 row lock
    DB-->>API: Transaction A transitions pending_hand_in to confirmed and credits C_spend
    API-->>AdminA: 200 OK (Spendable Balance Released Once)
    DB-->>API: Transaction B acquires lock and sees status = confirmed
    API->>DB: Transaction B rolls back
    API-->>AdminB: 400 or 409 Already Confirmed (Zero Double Credit)
```

### 5.2 External Merchant Website & Blendinar Hosted Checkout Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Tourist Customer
    participant Store as External Merchant Website
    participant Checkout as Blendinar Hosted Checkout
    participant DB as PostgreSQL

    Store->>Checkout: POST /api/merchant/checkout-sessions (API Key + Secret, 5000 DZD)
    Checkout->>DB: Validate active merchant, cap, return_url -> Save pending session
    Checkout-->>Store: sessionId + Hosted Checkout URL
    Store-->>Customer: Redirect browser to Blendinar Hosted Checkout
    Customer->>Checkout: Inspect Merchant Name, Website Domain, Badge, 0 Customer Fee
    Customer->>Checkout: POST confirm (Password + Idempotency-Key)
    Checkout->>Checkout: Verify JWT, live status = active, and bcrypt password BEFORE replay
    Checkout->>DB: Lock session, customer spendable, merchant payable, fee account (FOR UPDATE)
    DB-->>Checkout: Deduct 5000 DZD, credit Merchant (5000 - fee), credit Blendinar fee
    Checkout-->>Customer: 200 OK + Redirect to validated return_url
```

### 5.3 Daily Merchant CCP Payout State Machine & Double-Run Cutoff Guard

```mermaid
stateDiagram-v2
    [*] --> prepared : Daily cutoff batch locks payable balance
    prepared --> settled : Admin confirms simulated CCP transfer
    prepared --> delayed : Admin marks settlement delayed
    prepared --> failed : Simulated transfer fails (Payable preserved)
    settled --> disputed : Merchant or Admin flags discrepancy
    settled --> reversed : Corrective reconciliation entry appended
    delayed --> settled : Admin confirms settlement
    failed --> prepared : Re-queued in next valid batch
```

- Concurrent cutoff preparation or Admin settlement calls lock `(merchant_id, cutoff_window)` and the `merchant_payable` row (`FOR UPDATE`), ensuring a daily payout batch can settle **at most once**.

### 5.4 Customer Pre-Departure Refund Races (Payment vs. Refund & Cancel vs. Payout)

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Tourist
    actor Agent as Blendinar Agent
    participant API as Refund & Checkout Services
    participant DB as PostgreSQL

    par Payment vs Refund Lock Race (3000 DZD Spendable)
        Customer->>API: Confirm 3000 DZD Hosted Checkout
        Customer->>API: Request 3000 DZD Cash Refund Lock
    end
    API->>DB: Lock customer wallet row (FOR UPDATE)
    Note over API,DB: First transaction claims 3000 DZD; second sees 0 Spendable and rejects 400

    Note over Customer,DB: Later at Fixed-Location Office
    par Cancel vs Agent Payout Race
        Customer->>API: Cancel Refund Request (if allowed per O-10)
        Agent->>API: Verify Passport and Mark Refund Paid
    end
    API->>DB: Lock refund_request row + wallet row (FOR UPDATE)
    Note over API,DB: First updates status to paid (or cancelled); second fails cleanly
```
