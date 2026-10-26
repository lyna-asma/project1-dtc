# Plan: Wallet and Merchant Payment Platform (name to be chosen)

Status labels used below:
- **Confirmed**: the owner agreed to this when asked.
- **Delegated**: the owner told the analyst to decide. It can be changed.
- **Assumed**: not discussed in the interview. It is a proposed default and must be checked.

## 1. Problem

People who want to pay digitally but earn and hold cash need a place to put that cash and a way to spend it. This project is a demo of a digital wallet and merchant payment platform. **All money in it is fake.** It is modelled on the kind of service described publicly by Algerian payment startups such as Gifty, where a customer hands cash to a local shop, the shop credits the customer's wallet, and the customer then pays shops or sends money from a phone. It is not affiliated with any of them.

## 2. Why this project exists

- It is the final project of the AI Dev Tools Zoomcamp 2026.
- It is a portfolio piece that shows an app staying correct when many people use it at the same moment (two payments at once, the same request sent twice).

## 3. Users and what they can do

**Customer**
- Sign up with a phone number and a password.
- Hand cash to a shop and receive it in the wallet.
- Pay a shop.
- Send money to another customer by phone number (planned for a future version).
- See their own history of money movements.

**Merchant (a shop)**
- Add cash to a customer's wallet, using the shop's own balance.
- Ask a customer for a payment.
- See their own shop balance and history.

**Admin (the startup owner)**
- Load money into a shop's balance.
- Approve shops (planned for a future version).
- Reverse a transaction (planned for a future version).
- See all transactions.

No other roles exist in version 1.

## 4. Key words

- **Wallet / balance:** the amount of money a customer or a shop currently holds in the app.
- **Transaction:** one movement of money from one wallet to another.
- **History (ledger):** the list of every transaction. Lines are only ever added. They are never edited or deleted. A mistake is fixed by adding a new line that moves the money back.
- **Shop balance:** money the admin has loaded into a shop. A shop uses it to credit customers who give it cash.

## 5. Rules and decisions, with reasons

**R1. The customer's journey comes first.** (Delegated)
Merchants get only the features the customer journey needs. *Why:* the customer journey is the core of the demo and is where simultaneous-use problems appear. Without shops no money can enter, so the minimum shop features are built.

**R2. Three roles only: customer, merchant, admin.** (Confirmed)
*Why:* each extra role needs its own permissions to build and test. A support-agent role is in the backlog.

**R3. One currency, the Algerian dinar (DZD). Input is whole dinars. Amounts are stored as whole centimes.** (Confirmed)
*Why:* computers make small errors with decimal numbers, which add up to wrong totals. Whole numbers avoid that. Several currencies would need exchange rates, which is a separate project.

**R4. A balance never goes below zero.** (Confirmed)
A payment or transfer that would do so is rejected with a clear message. *Why:* it forces the app to check the balance and subtract in one step, which is the main safety rule against spending the same money twice. Overdraft is a credit feature and is in the backlog.

**R5. Three limits, fixed in one configuration file (planned for a future version).** (Confirmed)
- Maximum 50,000 DA per transaction.
- Maximum 100,000 DA per customer per day.
- Maximum balance of 200,000 DA per customer wallet.

*Why:* limits give testable rules and are a normal part of financial software. The values are invented for the demo. They are not claims about Algerian rules or about any provider. An admin screen to change them is in the backlog.

**R6. No fees in version 1.** (Confirmed)
*Why:* a fee turns one payment into several history lines and needs a business decision (who pays, how much). The structure must allow fees to be added later.

**R7. Sign-up uses a phone number and a password, with a simulated one-time code. No ID document check.** (Confirmed)
The code is shown in the server log or a test screen instead of being sent by SMS. Sending sits behind a single function so a real SMS provider can replace it later. *Why for not sending SMS now:* it costs money per message, it can be abused on a public site, reviewers would need real phone numbers to try the app, and automated tests must run without sending anything. Real SMS and ID checks are in the backlog. This is a deliberate simplification of real practice.

**R8. Cash top-up comes out of the shop's balance.** (Confirmed)
When a shop credits a customer with X DA, the shop balance goes down by X and the customer balance goes up by X. A top-up larger than the shop balance is rejected. The admin loads shop balances. *Why:* the total money in the system then changes only when the admin loads a shop, so a test can check that the totals always add up. Otherwise a shop could credit wallets without ever receiving cash.

**R9. A shop starts a payment and the customer confirms it with their password.** (Delegated)
The shop enters the amount and gets a payment code. The customer types the code, sees the shop name and the exact amount, and confirms. Money moves only after confirmation. *Why:* the customer sees what they pay before anything moves, and a shop cannot charge without approval. Scanning a QR code with the camera is in the backlog.

**R10. A customer can send money to another customer by phone number (planned for a future version).** (Confirmed)
The app shows the registered name of the recipient before the sender confirms with their password. The money arrives immediately and the recipient approves nothing. *Why:* showing the name reduces the chance of sending to a mistyped number. The same rules as payments apply.

**R11. History is never edited. Only an admin can reverse a transaction (reversals are planned for a future version).** (Confirmed)
A reversal is a new transaction that moves the money back, and the original is marked as reversed. If the receiver has already spent the money, the reversal is rejected, because balances cannot go below zero. Customer or shop refund requests inside the app are in the backlog. *Why:* the history must always tell the truth about what happened.

**R12. Safety when things happen at the same moment.** (Delegated)
- Two payments that together exceed the balance: exactly one succeeds and the other is rejected for insufficient balance.
- The same confirmation sent twice: the customer is charged once and the second attempt gets the same answer as the first.

*Why:* these are the real many-users problems of money software. Both are proved by a test that sends many requests at once and then checks the balances.

## 6. Main flows

**Sign up.** Enter phone number and password, receive the simulated code, enter it, and the account exists with a zero balance.

**Cash top-up.** The customer gives cash to a shop. The shop enters the customer's phone number and the amount. The shop balance goes down and the customer balance goes up. Both get a history line.

**Payment.** The shop enters an amount and gets a code. The customer enters the code, checks the shop name and amount, and confirms with the password. The customer balance goes down and the shop balance goes up.

**Transfer (planned for a future version).** The sender enters the recipient's phone number and amount, checks the recipient's name, and confirms with the password.

**Reversal (planned for a future version).** The admin selects a transaction and reverses it, which adds a new transaction in the opposite direction.

**Load shop balance.** The admin enters a shop and an amount, and the shop balance goes up by that amount.

## 7. Acceptance checks

Each line below must be provable by an automated test.

1. Signing up with a new phone number and the right code creates a customer with a zero balance. A wrong code does not.
2. A phone number already in use is rejected.
3. A shop top-up of X lowers the shop balance by X, raises the customer balance by X and creates a history line for each.
4. A top-up larger than the shop balance is rejected and nothing changes.
5. A confirmed payment lowers the customer balance and raises the shop balance by the same amount.
6. A wrong password moves no money.
7. A payment or transfer (transfers planned for a future version) larger than the balance is rejected and the balance is unchanged.
8. Amounts above 50,000 DA, a daily total above 100,000 DA, or a result above 200,000 DA in a customer wallet are rejected with a clear message (planned for a future version).
9. A transfer to an unknown phone number is rejected, and the confirmation screen shows the recipient's name (planned for a future version).
10. Two simultaneous payments of 800 DA from a balance of 1,000 DA: exactly one succeeds and the final balance is 200 DA.
11. The same confirmation sent twice with the same request identifier charges once and returns the same result.
12. An admin reversal moves the money back and marks the original. It fails if the receiver cannot cover it (planned for a future version).
13. After any sequence of operations, the sum of all customer and shop balances equals the total the admin has loaded.
14. A non-admin cannot use admin actions, and a customer cannot see another customer's history.

## 8. Version 1 scope and build order

1. Empty project with a passing test.
2. Sign-up, login and roles.
3. Wallets and history.
4. Admin loads a shop balance.
5. Cash top-up.
6. Payment.
7. Limits (planned for a future version).
8. Concurrency and repeat-request tests (payment confirmation idempotency and dual payment concurrency test completed; general transfer idempotency and 50-request stress test planned for a future version).
9. Transfers (planned for a future version).
10. Reversals (planned for a future version).
11. Shop history view and admin shop approval (shop approval planned for a future version).

Delivery work runs alongside the build and is also scored: automated tests with one command, Docker Compose with one command, continuous integration, deployment to a public URL (deployment to a public URL planned for a future version), and documentation. If time runs short, the build stops after step 8 and the delivery work still gets done.

## 9. Backlog (not in version 1)

Real SMS sending, ID document checks, QR code scanning, fees, overdraft, several currencies, an admin screen for limits, refund requests from customers and shops, shop payouts and daily summaries, a support-agent role, disputes, notifications, Arabic and French interface.

## 10. Assumptions and open items (not discussed in the interview)

- A payment code is single-use and expires after 5 minutes. (Assumed)
- The interface is in English in version 1. (Assumed)
- The first admin account is created by a setup script. (Assumed)
- A shop must be approved by the admin before it can be used. (Assumed; planned for a future version)
- Passwords are stored hashed, and login uses tokens. (Assumed)
- The history screen is a simple list per user, with no reports or exports. (Assumed)
- The technology stack is not chosen yet. A relational database (PostgreSQL) is recommended because it can keep a balance check and the deduction in one step. To be confirmed in the stack step.
- Hosting is not chosen yet.
- Expected load: the tests use about 50 simultaneous requests. This is a demo target, not a real-world figure. (Assumed)