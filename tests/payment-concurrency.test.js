import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { app } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { users, wallets, transactions, otpCodes, paymentRequests, idempotencyKeys } from '../src/db/schema.js';
import { generateToken } from '../src/middleware/auth.js';
import { adminLoadShopBalance, merchantTopUp } from '../src/services/wallet.js';
import { createPaymentRequest, confirmPaymentRequest } from '../src/services/payment.js';

describe('Task 9: Payment Idempotency & Concurrency Safety', () => {
  const cleanDb = async () => {
    await db.delete(idempotencyKeys);
    await db.delete(paymentRequests);
    await db.delete(transactions);
    await db.delete(wallets);
    await db.delete(otpCodes);
    await db.delete(users);
  };

  beforeAll(async () => {
    await cleanDb();
  });

  beforeEach(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
    await pool.end();
  });

  async function createVerifiedUser({ name, phone, role, password = 'Password123!' }) {
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(users)
      .values({
        name,
        phone,
        passwordHash,
        role,
        isVerified: true,
      })
      .returning();

    const [wallet] = await db
      .insert(wallets)
      .values({
        userId: user.id,
        balance: 0,
      })
      .returning();

    const token = generateToken({
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
    });

    return { user, wallet, token, password };
  }

  it('sending the same confirmation twice charges once and returns the same response', async () => {
    const admin = await createVerifiedUser({ name: 'Admin', phone: '0555000000', role: 'admin' });
    const merchant = await createVerifiedUser({ name: 'Shop Idemp', phone: '0555111111', role: 'merchant' });
    const customer = await createVerifiedUser({ name: 'Customer Idemp', phone: '0555222222', role: 'customer' });

    // 1. Admin loads 50,000 DA into shop
    await adminLoadShopBalance({
      merchantId: merchant.user.id,
      amountDinars: 50000,
    });

    // 2. Merchant tops up customer with 10,000 DA
    await merchantTopUp({
      merchantUserId: merchant.user.id,
      customerPhone: customer.user.phone,
      amountDinars: 10000,
    });

    // 3. Merchant creates a payment request of 3,000 DA
    const paymentRequest = await createPaymentRequest({
      merchantId: merchant.user.id,
      amountDinars: 3000,
    });

    const idempotencyKey = 'req-confirm-idempotency-key-001';

    // 4. First payment confirmation with idempotency key
    const res1 = await request(app)
      .post(`/api/customer/payment-requests/${paymentRequest.code}/confirm`)
      .set('Authorization', `Bearer ${customer.token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ password: customer.password });

    expect(res1.status).toBe(200);
    expect(res1.body.message).toBe('Payment confirmed successfully');
    expect(res1.body.amountDinars).toBe(3000);
    expect(res1.body.newCustomerBalanceDinars).toBe(7000);

    // Verify database balance after first confirmation
    const [customerWalletAfterFirst] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, customer.user.id));
    expect(Number(customerWalletAfterFirst.balance)).toBe(700000); // 7,000 DA = 700,000 centimes

    // 5. Sending the same confirmation request a second time with the same idempotency key
    const res2 = await request(app)
      .post(`/api/customer/payment-requests/${paymentRequest.code}/confirm`)
      .set('Authorization', `Bearer ${customer.token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ password: customer.password });

    expect(res2.status).toBe(200);
    // Returns the exact same response body
    expect(res2.body.message).toBe(res1.body.message);
    expect(res2.body.amountDinars).toBe(res1.body.amountDinars);
    expect(res2.body.newCustomerBalanceDinars).toBe(res1.body.newCustomerBalanceDinars);
    expect(res2.body.transaction.id).toBe(res1.body.transaction.id);

    // Verify customer balance was charged ONCE and not twice
    const [customerWalletAfterSecond] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, customer.user.id));
    expect(Number(customerWalletAfterSecond.balance)).toBe(700000); // Still 7,000 DA

    // Verify only 1 payment transaction exists in the ledger
    const paymentTxs = await db
      .select()
      .from(transactions)
      .where(eq(transactions.type, 'payment'));
    expect(paymentTxs.length).toBe(1);
  });

  it('two simultaneous 800 DA payments from a 1,000 DA balance: exactly one succeeds and leaves 200 DA', async () => {
    const admin = await createVerifiedUser({ name: 'Admin Concurrency', phone: '0555000001', role: 'admin' });
    const merchant = await createVerifiedUser({ name: 'Shop Concurrency', phone: '0555111112', role: 'merchant' });
    const customer = await createVerifiedUser({ name: 'Customer Concurrency', phone: '0555222223', role: 'customer' });

    // 1. Admin loads 10,000 DA into shop
    await adminLoadShopBalance({
      merchantId: merchant.user.id,
      amountDinars: 10000,
    });

    // 2. Merchant tops up customer with exactly 1,000 DA
    await merchantTopUp({
      merchantUserId: merchant.user.id,
      customerPhone: customer.user.phone,
      amountDinars: 1000,
    });

    // Verify initial customer balance is exactly 1,000 DA (100,000 centimes)
    const [custWalletBefore] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, customer.user.id));
    expect(Number(custWalletBefore.balance)).toBe(100000);

    // 3. Create two distinct payment requests of 800 DA each
    const req1 = await createPaymentRequest({
      merchantId: merchant.user.id,
      amountDinars: 800,
    });
    const req2 = await createPaymentRequest({
      merchantId: merchant.user.id,
      amountDinars: 800,
    });

    // 4. Send two simultaneous confirmations
    const [result1, result2] = await Promise.all([
      request(app)
        .post(`/api/customer/payment-requests/${req1.code}/confirm`)
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ password: customer.password }),
      request(app)
        .post(`/api/customer/payment-requests/${req2.code}/confirm`)
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ password: customer.password }),
    ]);

    const statuses = [result1.status, result2.status].sort();
    // One must be 200 OK, the other must be 400 Bad Request
    expect(statuses).toEqual([200, 400]);

    const successRes = result1.status === 200 ? result1 : result2;
    const failRes = result1.status === 400 ? result1 : result2;

    expect(successRes.body.message).toBe('Payment confirmed successfully');
    expect(failRes.body.error).toMatch(/insufficient.*balance/i);

    // 5. Verify the final customer balance is exactly 200 DA (20,000 centimes)
    const [custWalletAfter] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, customer.user.id));
    expect(Number(custWalletAfter.balance)).toBe(20000); // 200 DA

    // 6. Verify merchant shop balance increased by 800 DA
    const [merchantWalletAfter] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, merchant.user.id));
    // Initial loaded: 10,000 DA - 1,000 DA (top-up) + 800 DA (payment) = 9,800 DA (980,000 centimes)
    expect(Number(merchantWalletAfter.balance)).toBe(980000);

    // 7. Verify exactly one payment transaction was recorded in the ledger
    const paymentTxs = await db
      .select()
      .from(transactions)
      .where(eq(transactions.type, 'payment'));
    expect(paymentTxs.length).toBe(1);
    expect(Number(paymentTxs[0].amount)).toBe(80000); // 800 DA
  });

  it('the sum of all balances always equals the total loaded by the admin', async () => {
    const admin = await createVerifiedUser({ name: 'Admin Invariant', phone: '0555000002', role: 'admin' });
    const merchantA = await createVerifiedUser({ name: 'Shop A', phone: '0555111113', role: 'merchant' });
    const merchantB = await createVerifiedUser({ name: 'Shop B', phone: '0555111114', role: 'merchant' });
    const customerA = await createVerifiedUser({ name: 'Customer A', phone: '0555222224', role: 'customer' });
    const customerB = await createVerifiedUser({ name: 'Customer B', phone: '0555222225', role: 'customer' });

    // 1. Admin loads multiple amounts
    await adminLoadShopBalance({ merchantId: merchantA.user.id, amountDinars: 25000 });
    await adminLoadShopBalance({ merchantId: merchantB.user.id, amountDinars: 35000 });

    // Total admin loaded: 60,000 DA = 6,000,000 centimes
    const totalAdminLoadedCentimes = 60000 * 100;

    // 2. Perform sequential and concurrent top-ups and payments
    await merchantTopUp({
      merchantUserId: merchantA.user.id,
      customerPhone: customerA.user.phone,
      amountDinars: 5000,
    });

    await merchantTopUp({
      merchantUserId: merchantB.user.id,
      customerPhone: customerB.user.phone,
      amountDinars: 8000,
    });

    const payReqA = await createPaymentRequest({
      merchantId: merchantA.user.id,
      amountDinars: 2000,
    });
    const payReqB = await createPaymentRequest({
      merchantId: merchantB.user.id,
      amountDinars: 3500,
    });

    // Execute concurrent payments with idempotency keys
    await Promise.all([
      request(app)
        .post(`/api/customer/payment-requests/${payReqA.code}/confirm`)
        .set('Authorization', `Bearer ${customerA.token}`)
        .set('Idempotency-Key', 'idemp-inv-1')
        .send({ password: customerA.password }),
      request(app)
        .post(`/api/customer/payment-requests/${payReqB.code}/confirm`)
        .set('Authorization', `Bearer ${customerB.token}`)
        .set('Idempotency-Key', 'idemp-inv-2')
        .send({ password: customerB.password }),
    ]);

    // Send repeat idempotency requests
    await Promise.all([
      request(app)
        .post(`/api/customer/payment-requests/${payReqA.code}/confirm`)
        .set('Authorization', `Bearer ${customerA.token}`)
        .set('Idempotency-Key', 'idemp-inv-1')
        .send({ password: customerA.password }),
      request(app)
        .post(`/api/customer/payment-requests/${payReqB.code}/confirm`)
        .set('Authorization', `Bearer ${customerB.token}`)
        .set('Idempotency-Key', 'idemp-inv-2')
        .send({ password: customerB.password }),
    ]);

    // 3. Calculate sum of all balances in wallets table
    const [balanceSumResult] = await db
      .select({
        totalBalance: sql`COALESCE(SUM(${wallets.balance}), 0)`,
      })
      .from(wallets);

    const platformTotalCentimes = Number(balanceSumResult.totalBalance);

    // Sum of all balances must exactly equal total admin loaded
    expect(platformTotalCentimes).toBe(totalAdminLoadedCentimes);
  });

  describe('Task 16: Scoped Idempotency, Payload Mismatch, Auth-Before-Replay & Advisory Lock Race', () => {
    async function setupToppedUpCustomers() {
      const merchant = await createVerifiedUser({
        name: 'Task16 Merchant',
        phone: '0556100001',
        role: 'merchant',
      });
      const customerA = await createVerifiedUser({
        name: 'Customer Alpha',
        phone: '0556200001',
        role: 'customer',
        password: 'AlphaPassword123!',
      });
      const customerB = await createVerifiedUser({
        name: 'Customer Beta',
        phone: '0556200002',
        role: 'customer',
        password: 'BetaPassword123!',
      });

      await adminLoadShopBalance({
        merchantId: merchant.user.id,
        amountDinars: 50000,
      });

      await merchantTopUp({
        merchantUserId: merchant.user.id,
        customerPhone: customerA.user.phone,
        amountDinars: 10000,
      });

      await merchantTopUp({
        merchantUserId: merchant.user.id,
        customerPhone: customerB.user.phone,
        amountDinars: 10000,
      });

      return { merchant, customerA, customerB };
    }

    it('allows identical Idempotency-Key across two different users without collision', async () => {
      const { merchant, customerA, customerB } = await setupToppedUpCustomers();

      const reqA = await createPaymentRequest({ merchantId: merchant.user.id, amountDinars: 2000 });
      const reqB = await createPaymentRequest({ merchantId: merchant.user.id, amountDinars: 3000 });

      const [resA, resB] = await Promise.all([
        request(app)
          .post(`/api/customer/payment-requests/${reqA.code}/confirm`)
          .set('Authorization', `Bearer ${customerA.token}`)
          .set('Idempotency-Key', 'shared-key-1')
          .send({ password: customerA.password }),
        request(app)
          .post(`/api/customer/payment-requests/${reqB.code}/confirm`)
          .set('Authorization', `Bearer ${customerB.token}`)
          .set('Idempotency-Key', 'shared-key-1')
          .send({ password: customerB.password }),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(resA.body.amountDinars).toBe(2000);
      expect(resB.body.amountDinars).toBe(3000);
      expect(resA.body.newCustomerBalanceDinars).toBe(8000);
      expect(resB.body.newCustomerBalanceDinars).toBe(7000);
      expect(resA.body.transaction.id).not.toBe(resB.body.transaction.id);

      const savedKeys = await db.select().from(idempotencyKeys);
      expect(savedKeys).toHaveLength(2);
    });

    it('isolates idempotency keys per endpoint for the same customer', async () => {
      const { merchant, customerA } = await setupToppedUpCustomers();

      const req1 = await createPaymentRequest({ merchantId: merchant.user.id, amountDinars: 1200 });
      const req2 = await createPaymentRequest({ merchantId: merchant.user.id, amountDinars: 1800 });

      const result1 = await confirmPaymentRequest({
        code: req1.code,
        customerUserId: customerA.user.id,
        password: customerA.password,
        idempotencyKey: 'cross-endpoint-key-1',
        endpoint: 'POST /api/customer/payment-requests/:code/confirm',
      });

      const result2 = await confirmPaymentRequest({
        code: req2.code,
        customerUserId: customerA.user.id,
        password: customerA.password,
        idempotencyKey: 'cross-endpoint-key-1',
        endpoint: 'POST /api/v2/checkout/confirm',
      });

      expect(result1.amountDinars).toBe(1200);
      expect(result2.amountDinars).toBe(1800);
      expect(result1.transaction.id).not.toBe(result2.transaction.id);
      expect(result2.newCustomerBalanceDinars).toBe(7000);

      const savedKeys = await db.select().from(idempotencyKeys);
      expect(savedKeys).toHaveLength(2);
    });

    it('rejects wrong password with 401 BEFORE returning any cached idempotency replay', async () => {
      const { merchant, customerA } = await setupToppedUpCustomers();
      const payReq = await createPaymentRequest({ merchantId: merchant.user.id, amountDinars: 2500 });

      const firstRes = await request(app)
        .post(`/api/customer/payment-requests/${payReq.code}/confirm`)
        .set('Authorization', `Bearer ${customerA.token}`)
        .set('Idempotency-Key', 'pw-before-replay-1')
        .send({ password: customerA.password });

      expect(firstRes.status).toBe(200);

      const badPwRetry = await request(app)
        .post(`/api/customer/payment-requests/${payReq.code}/confirm`)
        .set('Authorization', `Bearer ${customerA.token}`)
        .set('Idempotency-Key', 'pw-before-replay-1')
        .send({ password: 'WrongPassword999!' });

      expect(badPwRetry.status).toBe(401);
      expect(badPwRetry.body).toEqual({ error: 'Invalid password' });

      const validRetry = await request(app)
        .post(`/api/customer/payment-requests/${payReq.code}/confirm`)
        .set('Authorization', `Bearer ${customerA.token}`)
        .set('Idempotency-Key', 'pw-before-replay-1')
        .send({ password: customerA.password });

      expect(validRetry.status).toBe(200);
      expect(validRetry.body.transaction.id).toBe(firstRes.body.transaction.id);
    });

    it('rejects payload mismatch with 409 when same Idempotency-Key is reused for a different code', async () => {
      const { merchant, customerA } = await setupToppedUpCustomers();
      const req1 = await createPaymentRequest({ merchantId: merchant.user.id, amountDinars: 1500 });
      const req2 = await createPaymentRequest({ merchantId: merchant.user.id, amountDinars: 2000 });

      const okRes = await request(app)
        .post(`/api/customer/payment-requests/${req1.code}/confirm`)
        .set('Authorization', `Bearer ${customerA.token}`)
        .set('Idempotency-Key', 'payload-mismatch-1')
        .send({ password: customerA.password });

      expect(okRes.status).toBe(200);

      // Reusing same key for another valid code -> 409
      const mismatchValidCode = await request(app)
        .post(`/api/customer/payment-requests/${req2.code}/confirm`)
        .set('Authorization', `Bearer ${customerA.token}`)
        .set('Idempotency-Key', 'payload-mismatch-1')
        .send({ password: customerA.password });

      expect(mismatchValidCode.status).toBe(409);
      expect(mismatchValidCode.body.error).toMatch(/different request parameters/i);

      // Reusing same key for a non-existent code -> still 409
      const mismatchMissingCode = await request(app)
        .post('/api/customer/payment-requests/NOPE99/confirm')
        .set('Authorization', `Bearer ${customerA.token}`)
        .set('Idempotency-Key', 'payload-mismatch-1')
        .send({ password: customerA.password });

      expect(mismatchMissingCode.status).toBe(409);

      // req2 must remain untouched and pending
      const [dbReq2] = await db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.code, req2.code));
      expect(dbReq2.status).toBe('pending');
    });

    it('serializes concurrent identical-key Promise.all confirmations so wallet is debited once', async () => {
      const { merchant, customerA } = await setupToppedUpCustomers();
      const payReq = await createPaymentRequest({ merchantId: merchant.user.id, amountDinars: 4000 });

      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/customer/payment-requests/${payReq.code}/confirm`)
          .set('Authorization', `Bearer ${customerA.token}`)
          .set('Idempotency-Key', 'concurrent-race-key-1')
          .send({ password: customerA.password }),
        request(app)
          .post(`/api/customer/payment-requests/${payReq.code}/confirm`)
          .set('Authorization', `Bearer ${customerA.token}`)
          .set('Idempotency-Key', 'concurrent-race-key-1')
          .send({ password: customerA.password }),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res2.body.transaction.id).toBe(res1.body.transaction.id);
      expect(res2.body.newCustomerBalanceCentimes).toBe(600000);

      const [custWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, customerA.user.id));
      expect(Number(custWallet.balance)).toBe(600000);

      const paymentTxs = await db
        .select()
        .from(transactions)
        .where(eq(transactions.type, 'payment'));
      expect(paymentTxs).toHaveLength(1);

      const savedKeys = await db.select().from(idempotencyKeys);
      expect(savedKeys).toHaveLength(1);
    });

    it('leaves idempotency_keys clean on _testFailureAfterBalanceUpdate rollback so retry succeeds', async () => {
      const { merchant, customerA } = await setupToppedUpCustomers();
      const payReq = await createPaymentRequest({ merchantId: merchant.user.id, amountDinars: 3000 });

      const failedRes = await request(app)
        .post(`/api/customer/payment-requests/${payReq.code}/confirm`)
        .set('Authorization', `Bearer ${customerA.token}`)
        .set('Idempotency-Key', 'rollback-retry-key-1')
        .send({
          password: customerA.password,
          _testFailureAfterBalanceUpdate: true,
        });

      expect(failedRes.status).toBe(500);
      expect(await db.select().from(idempotencyKeys)).toHaveLength(0);

      const [dbReqBeforeRetry] = await db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.code, payReq.code));
      expect(dbReqBeforeRetry.status).toBe('pending');

      const retryRes = await request(app)
        .post(`/api/customer/payment-requests/${payReq.code}/confirm`)
        .set('Authorization', `Bearer ${customerA.token}`)
        .set('Idempotency-Key', 'rollback-retry-key-1')
        .send({ password: customerA.password });

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.newCustomerBalanceDinars).toBe(7000);
      expect(await db.select().from(idempotencyKeys)).toHaveLength(1);
    });

    it('replays 200 receipt on completed idempotent retry even after expiresAt passes', async () => {
      const { merchant, customerA } = await setupToppedUpCustomers();
      const payReq = await createPaymentRequest({ merchantId: merchant.user.id, amountDinars: 1000 });

      const firstRes = await request(app)
        .post(`/api/customer/payment-requests/${payReq.code}/confirm`)
        .set('Authorization', `Bearer ${customerA.token}`)
        .set('Idempotency-Key', 'expired-after-complete-key')
        .send({ password: customerA.password });

      expect(firstRes.status).toBe(200);

      // Force payment request expiration timestamp into the past
      await db
        .update(paymentRequests)
        .set({ expiresAt: new Date(Date.now() - 60 * 1000) })
        .where(eq(paymentRequests.code, payReq.code));

      const lateRetry = await request(app)
        .post(`/api/customer/payment-requests/${payReq.code}/confirm`)
        .set('Authorization', `Bearer ${customerA.token}`)
        .set('Idempotency-Key', 'expired-after-complete-key')
        .send({ password: customerA.password });

      expect(lateRetry.status).toBe(200);
      expect(lateRetry.body.transaction.id).toBe(firstRes.body.transaction.id);

      const [custWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, customerA.user.id));
      expect(Number(custWallet.balance)).toBe(900000);
    });

    it('rejects oversized (> 255 chars) or non-string idempotency keys with 400', async () => {
      const { merchant, customerA } = await setupToppedUpCustomers();
      const payReq = await createPaymentRequest({ merchantId: merchant.user.id, amountDinars: 500 });

      const longKeyRes = await request(app)
        .post(`/api/customer/payment-requests/${payReq.code}/confirm`)
        .set('Authorization', `Bearer ${customerA.token}`)
        .set('Idempotency-Key', 'x'.repeat(256))
        .send({ password: customerA.password });

      expect(longKeyRes.status).toBe(400);
      expect(longKeyRes.body).toEqual({ error: 'Invalid idempotency key' });

      const nonStringRes = await request(app)
        .post(`/api/customer/payment-requests/${payReq.code}/confirm`)
        .set('Authorization', `Bearer ${customerA.token}`)
        .send({ password: customerA.password, idempotencyKey: 12345 });

      expect(nonStringRes.status).toBe(400);
      expect(nonStringRes.body).toEqual({ error: 'Invalid idempotency key' });
    });
  });
});

