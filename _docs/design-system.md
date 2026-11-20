# Design System & UI Guidelines

This document defines the frontend architecture, trust patterns, balance states, status badges, and accessibility rules for **Blendinar**.

---

## 1. Current Frontend Stack & Repository State

- **Stack:** React 19, Vite 6, Tailwind CSS 4 (`@tailwindcss/vite`, `@import "tailwindcss";` in `src/client/index.css`).
- **Current Verified State (`src/client/`):** Only a minimal placeholder starter card currently exists in `src/client/App.jsx` (*"Digital Wallet & Merchant Payment Platform"*). Full Customer, Agent, Merchant, Hosted Checkout, and Admin UI screens are planned and will follow the guidelines below as each frontend task is built.
- **Boundary Rule:** The React frontend is strictly a presentation and interaction layer over agreed backend APIs. It must **never** invent business rules, compute authoritative balances/fees/limits on its own, or trust client-side state over PostgreSQL/API responses.

---

## 2. Core Trust & Financial UX Principles

### A. Persistent Simulated-Money Notice
- Every page and portal (**Customer**, **Agent**, **Merchant**, **Hosted Checkout**, and **Admin**) **must** display a persistent, unmistakable simulated-money notice in the header or footer (and inside the Hosted Checkout view):
  - State clearly that **all balances, cash top-ups, merchant payouts, and cash refunds are 100% fake/simulated** for educational/portfolio demonstration, not real banking or payment processing.

### B. Whole Algerian Dinar (`DZD` / `DA`) Formatting
- Display all customer-facing amounts and balances in whole Algerian Dinars (`DA` / `DZD`, e.g., `5,000 DA` or `5,000 DZD`), converted deterministically from backend integer centimes (`Math.trunc(centimes / 100)` or exact integer formatting).
- Never use floating-point arithmetic in UI calculations; display raw backend-provided `amountDinars` / `balanceDinars` (and exact centimes only if fractional merchant fees are configured and explicitly returned by the API).

### C. Three Distinct Customer Balance States (Never Merged)
Customer wallet screens must **always** separate these three monetary states into distinct, clearly labeled cards/sections—**never** sum or merge them into one misleading "Total Balance":

| Balance State | Meaning | Required UI Label & Cue |
| :--- | :--- | :--- |
| **1. Spendable Balance** | Funds from admin-confirmed hand-ins available right now | Primary usable balance; usable for hosted merchant checkout and refund lock requests |
| **2. Pending Top-Ups** | Cash recorded by an agent awaiting Admin cash hand-in confirmation (Option B) | Explicit tag: **"Not yet spendable"**; list each pending top-up with amount, timestamp, and registered **Agent name & office/type** |
| **3. Locked for Refund** | Funds locked immediately when requesting a pre-departure physical cash refund | Explicit tag: **"Reserved for cash pickup — cannot be spent again"**; show refund pickup status |

### D. Customer-Facing Agent Identity Verification
- Physical badges, uniforms, printed receipts, or chat screenshots are **never** sufficient proof of authorization.
- Inside the customer's **own logged-in Blendinar account**, display:
  - The registered Agent's full name
  - Role type (`Fixed-Location Office / Partner Point` or `Individual Agent`)
  - Verification identifier / agent code
  - Pending top-up records created under that agent
- Include a clear customer safety prompt: *"Always verify the agent's identity and your pending top-up directly inside your own logged-in Blendinar account. Screenshots or physical badges alone are not proof."*

### E. Hosted Checkout Trust Elements
When a customer opens Blendinar's Hosted Checkout from an external merchant website, prominently display:
1. **Merchant Business Name** and registered **Website Domain**
2. **Manual Verification Badge:**
   - `Verified Merchant` (distinct positive badge)
   - `Unverified Merchant — lower transaction limits apply` (distinct amber warning badge)
3. **Gross Amount** in whole DZD
4. **Zero Customer Fee Notice:** Explicit `0 DZD customer fee` line item
5. **Password Confirmation & Error Clarity:** Explicit password confirmation step and clear, actionable error/retry messages (e.g., insufficient spendable balance, pending top-ups not yet spendable, expired session/code, transaction/daily limit exceeded, account suspended).

---

## 3. Consistent Semantic Status Badges

Every status badge must pair **accessible color contrast + clear text label + subtle icon/border** (never rely on color alone):

| Domain | Status Key | Visual Tone | Plain-English Meaning |
| :--- | :--- | :--- | :--- |
| **Account** | `active` | Emerald / Green | Account active and permitted to transact |
| **Account** | `suspended` | Rose / Red | Account suspended — financial mutations blocked; balances & history preserved |
| **Merchant Subscription** | `subscription_active` | Emerald / Green | Monthly B2B subscription active — merchant can create Hosted Checkout sessions (`O-06b`) |
| **Merchant Subscription** | `subscription_past_due` | Rose / Red | Monthly B2B subscription past due — new Hosted Checkout creation blocked (`403`); earned payable balances preserved (`O-06b`) |
| **Passport KYC** | `unverified_passport` | Slate / Gray | Account created; passport MRZ pre-scan not yet submitted (top-ups blocked) |
| **Passport KYC** | `prechecked_pending_agent` | Amber / Yellow | Customer submitted ICAO MRZ pre-scan; awaiting Agent physical passport check at first top-up (`O-02`) |
| **Passport KYC** | `passport_verified` | Emerald / Green | Agent physically verified passport against MRZ pre-check; eligible for cash top-ups (`O-02`) |
| **Passport KYC** | `passport_rejected` | Rose / Red | Agent rejected physical passport check (reason shown); top-ups blocked pending correction/review |
| **Top-Up / Hand-In** | `pending_hand_in` | Amber / Yellow | Cash collected by agent; **Not yet spendable** until Admin confirms hand-in |
| **Top-Up / Hand-In** | `confirmed` | Emerald / Green | Admin confirmed cash hand-in; spendable balance credited |
| **Top-Up / Hand-In** | `shortage_hold` | Orange / Amber-Dark | Cash hand-in shortage detected; held for Admin reconciliation |
| **Top-Up / Hand-In** | `disputed` | Rose / Red | Cash hand-in or transaction flagged as disputed for Admin review |
| **Refund** | `locked_refund` | Blue / Indigo | Customer balance locked; eligible for walk-in DZD cash payout `<= 20,000 DZD` at Fixed Offices (`O-09`) |
| **Refund** | `scheduled_next_day_pickup` | Amber / Yellow | Refund `> 20,000 DZD` or petty float low; scheduled for next-day Admin-funded office pickup (`O-09`) |
| **Refund** | `ready_for_pickup` | Slate / Blue | Next-day refund cash is funded and ready for customer pickup at `[Fixed Office]` (`O-09`) |
| **Refund** | `paid` | Emerald / Green | Physical cash refund paid out by agent and recorded (`0 DZD` fee) |
| **Refund** | `cancelled` | Slate / Gray | Customer cancelled uncollected refund; funds unlocked back to Spendable Balance (`O-10`) |
| **Refund** | `expired` | Slate / Gray | Refund auto-expired after **72 hours** uncollected; funds unlocked back to Spendable Balance (`O-10`) |
| **Payment / Payout** | `prepared` | Slate / Blue | Daily CCP payout batch prepared; awaiting Admin settlement review |
| **Payment / Payout** | `settled` | Emerald / Green | Simulated CCP payout confirmed & settled by Admin |
| **Payment / Payout** | `failed` | Rose / Red | Payment or simulated CCP payout failed; clear retry/resolution state shown |

*(Also support legacy/standard states cleanly where displayed: `pending`, `completed`, `reversed`, `canceled`.)*

---

## 4. Accessibility, Layout & Localization Readiness

- **Keyboard & Screen-Reader Accessibility:**
  - Use semantic HTML (`<header>`, `<main>`, `<nav>`, `<button>`, `<label htmlFor=...>`, `<table>` for ledgers/batches).
  - Preserve visible keyboard focus rings (`focus-visible:outline-*`), logical tab order, minimum ~44×44px touch targets on primary actions, and `aria-live="polite"` / `role="alert"` regions for form and payment confirmation errors.
- **Language & Future Localization:**
  - Version 1 UI copy is **English-first**, concise, and plain-English.
  - Use logical CSS / Tailwind spacing (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `text-end` where appropriate) and avoid fixed-width text containers so future **Arabic (`dir="rtl"`)** and **French** translations fit without layout breakage.
- **Responsive Design:**
  - Mobile-first layout for Customer, Agent, and Hosted Checkout flows (phone-friendly cash drop-offs and checkout approvals); clean responsive data tables for Merchant and Admin reconciliation dashboards.

---

## 5. Notifications, Persistent Banners, Confirmation Modals, Reminders & Cookies Policy

### 5A. Persistent Contextual Banners (`Confirmed`)
- **Global Simulated Money Banner:** Non-dismissible prototype warning on all portals and Hosted Checkout (`100% fake / simulated DZD`, zero real bank/CCP/card transfers).
- **Pre-Departure Refund Planning Banner (`O-09 Confirmed`):** Displayed persistently on the **Customer Wallet Dashboard** and **Refund Request** page before airport departure:
  *"Walk-in cash refunds up to **20,000 DZD** are paid from Fixed-Location Office petty float while supplies last. Refunds above **20,000 DZD** (or when office float is low) schedule a **next-day pickup** funded by Admin treasury — please request refunds at least **24 hours before departing Algeria**."*
- **Passport KYC Progress Banner (`O-02 Confirmed`):** Guides customers clearly through `unverified_passport` -> `prechecked_pending_agent` ("Bring your physical passport to an authorized Agent at first top-up") -> `passport_verified` -> `passport_rejected` (shows Agent rejection reason and retry/Admin review guidance).
- **Read-Only Suspended Account Banner (`O-03 Confirmed`):** Shown to `suspended` accounts explaining exact suspension reason, confirming balances/ledger history are safely preserved, and stating all financial/state-changing mutations are blocked.
- **Merchant Subscription Renewal Warning Banner (`O-06b Confirmed` / `Delegated`):** Displayed persistently on the **Merchant Portal** when a merchant's monthly B2B subscription (`merchant_subscriptions`) is approaching renewal or `past_due`: clearly states new Hosted Checkout creation is blocked (`403 Merchant subscription required`) until renewed by Admin, while confirming already-earned **Merchant Payable Balance** continues settling normally via daily CCP payouts.

### 5B. In-App Notifications, Action Badges & Reminders (`Proposed` v1 UX)
- **Channel Strategy:** Every notification writes to an **in-app notification bell/feed** with unread badge counts across portals; in `DEMO_MODE`, notification events also emit structured simulated email alerts via the replaceable delivery adapter (no real email/SMS/push infrastructure in v1).
- **Customer Events & Reminders:**
  - Cash top-up recorded (`pending_hand_in` — clearly labeled *Not Yet Spendable*), Cash Hand-In `confirmed` (*Spendable Balance credited*), or `shortage_hold` / `disputed` review notice.
  - Step 2 Agent passport check outcome (`passport_verified` or `passport_rejected` with reason).
  - Hosted Checkout payment receipt (`gross DZD`, **`0 DZD` customer fee**, merchant name/domain).
  - Pre-departure refund updates: immediate `locked_refund`, **`scheduled_next_day_pickup`**, **`ready_for_pickup` at `[Fixed Office]`** (`O-09 Confirmed`), and `paid`.
  - **Pre-72h Expiry Reminder (`O-10` follow-up):** Triggered before an uncollected refund reaches the **72-hour** auto-expiry cutoff (e.g., at **48h** / **24h remaining**), prompting the customer either to visit a Fixed Office for payout or self-cancel cleanly back to Spendable Balance.
- **Agent Events & Reminders:**
  - Pre-checked customers waiting at counter (`prechecked_pending_agent`), **`80%` Cash-Exposure Cap warning** reminding Agent to submit Cash Hand-In before cap blocks new top-ups, Admin hand-in confirmation or `shortage_hold` / `disputed` alert, and funded `ready_for_pickup` next-day refund payouts assigned to their Fixed Office.
- **Merchant Events & Reminders:**
  - Account verification upgrade (`Unverified` -> `Verified`), completed Hosted Checkout receipts (`gross - configurable 2% fee` net credit per Stream 2), Daily Simulated CCP Payout `prepared` / `settled` / `failed` notices, and **Monthly Subscription Renewal Reminder & `past_due` alerts (`O-06b` Stream 1 — emitted in-app and in `DEMO_MODE` logs)** warning before/when new Hosted Checkout creation is paused while earned payables continue settling.
- **Admin Queue Badges:**
  - Unread/action counts for Cash Hand-In approvals, `shortage_hold` / `disputed` escalations, Agent onboarding & Fixed-Office petty-float replenishments (`O-09`), Merchant verification requests, **Monthly Merchant Subscription confirmations / `past_due` renewals (`O-06b`)**, Daily CCP Payout cutoff review, and passport anomaly reviews.

### 5C. Critical Confirmation Pop-Ups / Modals (`Proposed` Guardrails)
- **Hosted Checkout Payment Confirmation Modal:** Shows verified Merchant badge + website URL, exact gross DZD, **`0 DZD` customer fee**, and **live password input** before executing payment.
- **Refund Request & Lock Confirmation Modal:** Explains immediate lock out of Spendable Balance, **72-hour** expiry rule, **`0 DZD` customer fee**, and transparently classifies the request as **walk-in eligible (`<= 20,000 DZD` Fixed Office petty float)** or **`scheduled_next_day_pickup` (`> 20,000 DZD` or insufficient float)** before confirmation.
- **Agent Physical Passport Check Modal (`O-02` Step 2):** Displays pre-checked ICAO MRZ summary (name match, masked passport hint, issuing country, expiry) side-by-side; Agent clicks **Approve** or **Reject (mandatory reason)** without manually typing raw passport numbers.
- **Agent Cash-Receipt Confirmation Modal:** Confirms customer in-app Agent verification check + selected fixed top-up preset (`1,000 / 2,000 / 5,000 / 10,000 / 20,000 DZD`) + notice that funds stay `pending_hand_in` until Admin confirmation.
- **Admin Custody & Destructive Modals:** Cash Hand-In `confirmed` vs `shortage_hold` modal (showing expected vs counted DZD), Account Suspension modal (mandatory reason), Merchant verification approval modal, **Admin Merchant Subscription Renewal / Confirmation Modal (`O-06b`)** confirming simulated monthly B2B subscription receipt (`2,000 DZD/month` configurable default, restoring `past_due -> active`), and Daily CCP Payout `settled` confirmation modal.

### 5D. Cookies & Browser Storage Policy (`Proposed` — Essential-Only Standard)
- **Zero Tracking / Advertising Cookies:** Blendinar uses **zero** third-party advertising, analytics, or behavioral tracking cookies — eliminating unnecessary marketing cookie-consent pop-ups.
- **Strictly Essential Session / Auth Storage Only:** Only strictly necessary authentication/session state is stored in the browser (`HttpOnly; SameSite=Lax; Secure` session cookie with CSRF protection **or** tightly scoped JWT bearer storage; exact mechanism finalized cleanly during `M1`/`M9` frontend auth hardening against XSS/CSRF).
- **Minimal Footer Notice:** Every screen footer states simply: *"Essential session storage only — no tracking cookies. Simulated DZD educational prototype."*
