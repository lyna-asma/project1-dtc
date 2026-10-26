import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { app } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { users, wallets, transactions, otpCodes, paymentRequests } from '../src/db/schema.js';
import { generateToken } from '../src/middleware/auth.js';

describe('Merchant Payment Code Generation & Customer Confirmation (Issue #12)', () => {
  const cleanDb = async () => {
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

  async function createUser({
    name,
    phone,
    role = 'customer',
    isVerified = true,
    createWallet = true,
    initialBalance = 0,
    password = 'Password123!',
  }) {
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(users)
      .values({
        name,
        phone,
        passwordHash,
        role,
        isVerified,
      })
      .returning();

    let wallet = null;
    if (createWallet) {
      const [createdWallet] = await db
        .insert(wallets)
        .values({
          userId: user.id,
          balance: initialBalance,
        })
        .returning();
      wallet = createdWallet;
    }

    const token = generateToken({
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
    });

    return { user, wallet, token, password };
  }

  describe('Route Security & Role Guarding', () => {
    it('POST /api/merchant/payment-requests rejects unauthenticated or unauthorized roles', async () => {
      const merchant = await createUser({
        name: 'Merchant 1',
        phone: '0551000001',
        role: 'merchant',
      });
      const customer = await createUser({
        name: 'Customer 1',
        phone: '0551000002',
        role: 'customer',
      });
      const admin = await createUser({
        name: 'Admin 1',
        phone: '0551000003',
        role: 'admin',
      });

      // No auth
      const noAuthRes = await request(app)
        .post('/api/merchant/payment-requests')
        .send({ amountDinars: 100 });
      expect(noAuthRes.status).toBe(401);

      // Customer role -> 403
      const custRes = await request(app)
        .post('/api/merchant/payment-requests')
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ amountDinars: 100 });
      expect(custRes.status).toBe(403);

      // Admin role -> 403
      const adminRes = await request(app)
        .post('/api/merchant/payment-requests')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ amountDinars: 100 });
      expect(adminRes.status).toBe(403);
    });

    it('GET /api/customer/payment-requests/:code rejects unauthenticated or unauthorized roles', async () => {
      const merchant = await createUser({
        name: 'Merchant 1',
        phone: '0551000001',
        role: 'merchant',
      });
      const admin = await createUser({
        name: 'Admin 1',
        phone: '0551000003',
        role: 'admin',
      });

      // No auth
      const noAuthRes = await request(app)
        .get('/api/customer/payment-requests/CODE12');
      expect(noAuthRes.status).toBe(401);

      // Merchant role -> 403
      const merchRes = await request(app)
        .get('/api/customer/payment-requests/CODE12')
        .set('Authorization', `Bearer ${merchant.token}`);
      expect(merchRes.status).toBe(403);

      // Admin role -> 403
      const adminRes = await request(app)
        .get('/api/customer/payment-requests/CODE12')
        .set('Authorization', `Bearer ${admin.token}`);
      expect(adminRes.status).toBe(403);
    });

    it('POST /api/customer/payment-requests/:code/confirm rejects unauthenticated or unauthorized roles', async () => {
      const merchant = await createUser({
        name: 'Merchant 1',
        phone: '0551000001',
        role: 'merchant',
      });
      const admin = await createUser({
        name: 'Admin 1',
        phone: '0551000003',
        role: 'admin',
      });

      // No auth
      const noAuthRes = await request(app)
        .post('/api/customer/payment-requests/CODE12/confirm')
        .send({ password: 'Password123!' });
      expect(noAuthRes.status).toBe(401);

      // Merchant role -> 403
      const merchRes = await request(app)
        .post('/api/customer/payment-requests/CODE12/confirm')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ password: 'Password123!' });
      expect(merchRes.status).toBe(403);

      // Admin role -> 403
      const adminRes = await request(app)
        .post('/api/customer/payment-requests/CODE12/confirm')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ password: 'Password123!' });
      expect(adminRes.status).toBe(403);
    });
  });

  describe('Payment Code Generation (POST /api/merchant/payment-requests)', () => {
    it('validates amount input: missing, zero, negative, fractional, string', async () => {
      const merchant = await createUser({
        name: 'Grocery Shop',
        phone: '0552000001',
        role: 'merchant',
      });

      const invalidPayloads = [
        {},
        { amountDinars: 0 },
        { amountDinars: -100 },
        { amountDinars: 10.5 },
        { amountDinars: '200' },
        { amountDinars: null },
        { amount: -5 },
        { amount: 0 },
        { amount: 15.75 },
      ];

      for (const payload of invalidPayloads) {
        const res = await request(app)
          .post('/api/merchant/payment-requests')
          .set('Authorization', `Bearer ${merchant.token}`)
          .send(payload);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('amountDinars must be a positive integer');
      }
    });

    it('rejects amount exceeding MAX_SAFE_INTEGER', async () => {
      const merchant = await createUser({
        name: 'Grocery Shop',
        phone: '0552000001',
        role: 'merchant',
      });

      const res = await request(app)
        .post('/api/merchant/payment-requests')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ amountDinars: Number.MAX_SAFE_INTEGER + 1000 });

      expect(res.status).toBe(400);
    });

    it('supports fallback "amount" field when amountDinars is omitted', async () => {
      const merchant = await createUser({
        name: 'Supermarket Express',
        phone: '0552000002',
        role: 'merchant',
      });

      const res = await request(app)
        .post('/api/merchant/payment-requests')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ amount: 1500 });

      expect(res.status).toBe(201);
      expect(res.body.amountDinars).toBe(1500);
      expect(res.body.amountCentimes).toBe(150000);
      expect(res.body.status).toBe('pending');
      expect(typeof res.body.code).toBe('string');
      expect(res.body.code.length).toBe(6);
    });

    it('successfully generates a unique 6-character code with 5-minute expiration and pending DB record', async () => {
      const merchant = await createUser({
        name: 'Tech Shop',
        phone: '0552000003',
        role: 'merchant',
      });

      const beforeTime = Date.now();

      const res = await request(app)
        .post('/api/merchant/payment-requests')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ amountDinars: 5000 });

      const afterTime = Date.now();

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        code: expect.any(String),
        amountDinars: 5000,
        amountCentimes: 500000,
        expiresAt: expect.any(String),
        status: 'pending',
      });

      expect(res.body.code.length).toBe(6);

      const expiresAtMs = new Date(res.body.expiresAt).getTime();
      const expectedMinExpiresAt = beforeTime + 5 * 60 * 1000;
      const expectedMaxExpiresAt = afterTime + 5 * 60 * 1000;
      expect(expiresAtMs).toBeGreaterThanOrEqual(expectedMinExpiresAt - 2000);
      expect(expiresAtMs).toBeLessThanOrEqual(expectedMaxExpiresAt + 2000);

      // Verify row in database
      const [dbRow] = await db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.code, res.body.code))
        .limit(1);

      expect(dbRow).toBeDefined();
      expect(dbRow.merchantId).toBe(merchant.user.id);
      expect(Number(dbRow.amount)).toBe(500000);
      expect(dbRow.status).toBe('pending');
    });
  });

  describe('Payment Code Inspection (GET /api/customer/payment-requests/:code)', () => {
    it('returns 404 for non-existent code', async () => {
      const customer = await createUser({
        name: 'Alice',
        phone: '0553000001',
        role: 'customer',
      });

      const res = await request(app)
        .get('/api/customer/payment-requests/NONEXISTENT')
        .set('Authorization', `Bearer ${customer.token}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Payment request not found' });
    });

    it('returns 200 with shop details and amount for valid pending code', async () => {
      const merchant = await createUser({
        name: 'Boutique Parisienne',
        phone: '0553000002',
        role: 'merchant',
      });
      const customer = await createUser({
        name: 'Alice',
        phone: '0553000001',
        role: 'customer',
      });

      // Generate code
      const genRes = await request(app)
        .post('/api/merchant/payment-requests')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ amountDinars: 2500 });

      expect(genRes.status).toBe(201);
      const { code } = genRes.body;

      // Inspect code as customer
      const inspectRes = await request(app)
        .get(`/api/customer/payment-requests/${code}`)
        .set('Authorization', `Bearer ${customer.token}`);

      expect(inspectRes.status).toBe(200);
      expect(inspectRes.body).toEqual({
        code,
        shopName: 'Boutique Parisienne',
        shopPhone: '0553000002',
        amountDinars: 2500,
        amountCentimes: 250000,
        expiresAt: genRes.body.expiresAt,
        status: 'pending',
      });
    });

    it('returns 400 when inspecting an already completed code', async () => {
      const merchant = await createUser({
        name: 'Boutique Parisienne',
        phone: '0553000002',
        role: 'merchant',
      });
      const customer = await createUser({
        name: 'Alice',
        phone: '0553000001',
        role: 'customer',
      });

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const [req] = await db
        .insert(paymentRequests)
        .values({
          code: 'USED99',
          merchantId: merchant.user.id,
          amount: 100000,
          status: 'completed',
          expiresAt,
        })
        .returning();

      const res = await request(app)
        .get(`/api/customer/payment-requests/${req.code}`)
        .set('Authorization', `Bearer ${customer.token}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Payment code already used' });
    });

    it('returns 400 and updates status to expired when inspecting an expired code', async () => {
      const merchant = await createUser({
        name: 'Boutique Parisienne',
        phone: '0553000002',
        role: 'merchant',
      });
      const customer = await createUser({
        name: 'Alice',
        phone: '0553000001',
        role: 'customer',
      });

      // Insert already expired code
      const expiresAt = new Date(Date.now() - 10000);
      const [req] = await db
        .insert(paymentRequests)
        .values({
          code: 'EXP123',
          merchantId: merchant.user.id,
          amount: 100000,
          status: 'pending',
          expiresAt,
        })
        .returning();

      const res = await request(app)
        .get(`/api/customer/payment-requests/${req.code}`)
        .set('Authorization', `Bearer ${customer.token}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Payment code has expired' });

      // Verify status in DB was updated to expired
      const [updated] = await db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.id, req.id))
        .limit(1);

      expect(updated.status).toBe('expired');
    });
  });

  describe('Payment Confirmation & Password Validation (POST /api/customer/payment-requests/:code/confirm)', () => {
    it('returns 400 when password is missing or empty', async () => {
      const customer = await createUser({
        name: 'Bob',
        phone: '0554000001',
        role: 'customer',
        initialBalance: 1000000,
      });

      const res1 = await request(app)
        .post('/api/customer/payment-requests/ANYCOD/confirm')
        .set('Authorization', `Bearer ${customer.token}`)
        .send({});

      expect(res1.status).toBe(400);
      expect(res1.body).toEqual({ error: 'Password is required' });

      const res2 = await request(app)
        .post('/api/customer/payment-requests/ANYCOD/confirm')
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ password: '   ' });

      expect(res2.status).toBe(400);
      expect(res2.body).toEqual({ error: 'Password is required' });
    });

    it('returns 404 for non-existent code on confirmation', async () => {
      const customer = await createUser({
        name: 'Bob',
        phone: '0554000001',
        role: 'customer',
        password: 'Password123!',
      });

      const res = await request(app)
        .post('/api/customer/payment-requests/NONEXI/confirm')
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ password: 'Password123!' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Payment request not found' });
    });

    it('returns 401 on wrong password and leaves balances and ledger untouched', async () => {
      const merchant = await createUser({
        name: 'Hardware Store',
        phone: '0554000002',
        role: 'merchant',
        initialBalance: 0,
      });
      const customer = await createUser({
        name: 'Bob',
        phone: '0554000001',
        role: 'customer',
        initialBalance: 500000, // 5,000 DA
        password: 'CorrectPassword123!',
      });

      // Merchant creates request
      const genRes = await request(app)
        .post('/api/merchant/payment-requests')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ amountDinars: 1000 });

      const { code } = genRes.body;

      // Customer confirms with WRONG password
      const confirmRes = await request(app)
        .post(`/api/customer/payment-requests/${code}/confirm`)
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ password: 'WrongPassword999!' });

      expect(confirmRes.status).toBe(401);
      expect(confirmRes.body).toEqual({ error: 'Invalid password' });

      // Verify NO money moved
      const [custWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, customer.user.id));
      expect(Number(custWallet.balance)).toBe(500000);

      const [merchWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, merchant.user.id));
      expect(Number(merchWallet.balance)).toBe(0);

      // Verify no transaction record created
      const allTx = await db.select().from(transactions);
      expect(allTx.length).toBe(0);

      // Verify code status is still pending
      const [dbReq] = await db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.code, code));
      expect(dbReq.status).toBe('pending');
    });

    it('returns 400 when confirming an expired code and leaves balances untouched', async () => {
      const merchant = await createUser({
        name: 'Hardware Store',
        phone: '0554000002',
        role: 'merchant',
        initialBalance: 0,
      });
      const customer = await createUser({
        name: 'Bob',
        phone: '0554000001',
        role: 'customer',
        initialBalance: 500000,
        password: 'Password123!',
      });

      const [req] = await db
        .insert(paymentRequests)
        .values({
          code: 'EXPIR8',
          merchantId: merchant.user.id,
          amount: 100000,
          status: 'pending',
          expiresAt: new Date(Date.now() - 5000),
        })
        .returning();

      const res = await request(app)
        .post(`/api/customer/payment-requests/${req.code}/confirm`)
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ password: 'Password123!' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Payment code has expired' });

      // Verify balances unchanged
      const [custWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, customer.user.id));
      expect(Number(custWallet.balance)).toBe(500000);

      // Verify status updated to expired
      const [updatedReq] = await db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.id, req.id));
      expect(updatedReq.status).toBe('expired');
    });

    it('returns 400 Cannot pay yourself if customer is the merchant', async () => {
      // Create user with merchant role
      const merchant = await createUser({
        name: 'Self Shop',
        phone: '0554000005',
        role: 'merchant',
        initialBalance: 500000,
        password: 'Password123!',
      });

      const genRes = await request(app)
        .post('/api/merchant/payment-requests')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ amountDinars: 500 });

      // Generate a token for this user with role customer so it reaches confirmation handler
      const customerTokenForMerchant = generateToken({
        id: merchant.user.id,
        phone: merchant.user.phone,
        name: merchant.user.name,
        role: 'customer',
      });

      const res = await request(app)
        .post(`/api/customer/payment-requests/${genRes.body.code}/confirm`)
        .set('Authorization', `Bearer ${customerTokenForMerchant}`)
        .send({ password: 'Password123!' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Cannot pay yourself' });
    });

    it('returns 400 Insufficient customer balance and moves NO money', async () => {
      const merchant = await createUser({
        name: 'Pastry Shop',
        phone: '0554000007',
        role: 'merchant',
        initialBalance: 10000,
      });
      const customer = await createUser({
        name: 'Poor Customer',
        phone: '0554000008',
        role: 'customer',
        initialBalance: 20000, // 200 DA (20000 centimes)
        password: 'Password123!',
      });

      // Request is for 500 DA (50000 centimes)
      const genRes = await request(app)
        .post('/api/merchant/payment-requests')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ amountDinars: 500 });

      const res = await request(app)
        .post(`/api/customer/payment-requests/${genRes.body.code}/confirm`)
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ password: 'Password123!' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Insufficient customer balance' });

      // Verify no balance changed
      const [custWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, customer.user.id));
      expect(Number(custWallet.balance)).toBe(20000);

      const [merchWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, merchant.user.id));
      expect(Number(merchWallet.balance)).toBe(10000);

      const allTx = await db.select().from(transactions);
      expect(allTx.length).toBe(0);
    });
  });

  describe('Atomic Execution, Deterministic Locking & Ledger Entry', () => {
    it('successfully confirms payment: decrements customer, increments merchant, appends immutable ledger', async () => {
      const merchant = await createUser({
        name: 'Bookstore Central',
        phone: '0555000001',
        role: 'merchant',
        initialBalance: 200000, // 2,000 DA
      });
      const customer = await createUser({
        name: 'Charlie',
        phone: '0555000002',
        role: 'customer',
        initialBalance: 500000, // 5,000 DA
        password: 'BookLover2026!',
      });

      // Merchant generates code for 1,500 DA
      const genRes = await request(app)
        .post('/api/merchant/payment-requests')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ amountDinars: 1500 });

      expect(genRes.status).toBe(201);
      const { code } = genRes.body;

      // Customer confirms
      const confirmRes = await request(app)
        .post(`/api/customer/payment-requests/${code}/confirm`)
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ password: 'BookLover2026!' });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body).toEqual({
        message: 'Payment confirmed successfully',
        code,
        amountDinars: 1500,
        amountCentimes: 150000,
        shopName: 'Bookstore Central',
        newCustomerBalanceDinars: 3500,
        newCustomerBalanceCentimes: 350000,
        transaction: {
          id: expect.any(Number),
          type: 'payment',
          amountDinars: 1500,
          amountCentimes: 150000,
          fromWalletId: customer.wallet.id,
          toWalletId: merchant.wallet.id,
          status: 'completed',
          createdAt: expect.any(String),
        },
      });

      // Verify DB balances
      const [updatedCustWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, customer.wallet.id));
      expect(Number(updatedCustWallet.balance)).toBe(350000);

      const [updatedMerchWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, merchant.wallet.id));
      expect(Number(updatedMerchWallet.balance)).toBe(350000); // 200000 + 150000

      // Verify payment request status completed
      const [updatedReq] = await db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.code, code));
      expect(updatedReq.status).toBe('completed');

      // Verify immutable transaction record in DB
      const [txRow] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, confirmRes.body.transaction.id));

      expect(txRow.type).toBe('payment');
      expect(txRow.fromWalletId).toBe(customer.wallet.id);
      expect(txRow.toWalletId).toBe(merchant.wallet.id);
      expect(Number(txRow.amount)).toBe(150000);
      expect(Number(txRow.feeAmount)).toBe(0);
      expect(txRow.status).toBe('completed');
      expect(txRow.referenceId).toBe(updatedReq.id);
      expect(txRow.description).toBe('Payment to Bookstore Central');
    });

    it('provisions customer or merchant wallet if either does not yet exist', async () => {
      const merchant = await createUser({
        name: 'New Merchant Without Wallet',
        phone: '0555000010',
        role: 'merchant',
        createWallet: false, // merchant has NO wallet yet
      });
      const customer = await createUser({
        name: 'Rich Customer',
        phone: '0555000011',
        role: 'customer',
        initialBalance: 100000, // 1,000 DA
        password: 'Password123!',
      });

      // Merchant creates payment request
      const genRes = await request(app)
        .post('/api/merchant/payment-requests')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ amountDinars: 300 });

      expect(genRes.status).toBe(201);

      // Customer confirms
      const confirmRes = await request(app)
        .post(`/api/customer/payment-requests/${genRes.body.code}/confirm`)
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ password: 'Password123!' });

      expect(confirmRes.status).toBe(200);

      // Merchant wallet was provisioned and credited with 30,000 centimes
      const [merchantWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, merchant.user.id));

      expect(merchantWallet).toBeDefined();
      expect(Number(merchantWallet.balance)).toBe(30000);
    });

    it('enforces replay protection: second confirmation on same code returns 400 and deducts no further money', async () => {
      const merchant = await createUser({
        name: 'Coffee Shop',
        phone: '0556000001',
        role: 'merchant',
        initialBalance: 0,
      });
      const customer = await createUser({
        name: 'David',
        phone: '0556000002',
        role: 'customer',
        initialBalance: 400000, // 4,000 DA
        password: 'CoffeeLover123!',
      });

      const genRes = await request(app)
        .post('/api/merchant/payment-requests')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ amountDinars: 600 });

      const { code } = genRes.body;

      // 1st confirm -> 200
      const firstRes = await request(app)
        .post(`/api/customer/payment-requests/${code}/confirm`)
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ password: 'CoffeeLover123!' });

      expect(firstRes.status).toBe(200);
      expect(firstRes.body.newCustomerBalanceDinars).toBe(3400);

      // 2nd confirm -> 400
      const secondRes = await request(app)
        .post(`/api/customer/payment-requests/${code}/confirm`)
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ password: 'CoffeeLover123!' });

      expect(secondRes.status).toBe(400);
      expect(secondRes.body).toEqual({ error: 'Payment code already used' });

      // Verify balances: customer still has 3400 DA (340000 centimes), merchant 600 DA
      const [custWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, customer.wallet.id));
      expect(Number(custWallet.balance)).toBe(340000);

      const [merchWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, merchant.wallet.id));
      expect(Number(merchWallet.balance)).toBe(60000);

      // Ledger only has 1 transaction
      const txRows = await db.select().from(transactions);
      expect(txRows.length).toBe(1);
    });

    it('rolls back completely if a failure occurs during transaction execution', async () => {
      const merchant = await createUser({
        name: 'Grocery Corner',
        phone: '0557000001',
        role: 'merchant',
        initialBalance: 50000,
      });
      const customer = await createUser({
        name: 'Eve',
        phone: '0557000002',
        role: 'customer',
        initialBalance: 150000,
        password: 'EvePassword123!',
      });

      const genRes = await request(app)
        .post('/api/merchant/payment-requests')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ amountDinars: 800 });

      const { code } = genRes.body;

      // Call confirm with simulated failure flag
      const confirmRes = await request(app)
        .post(`/api/customer/payment-requests/${code}/confirm`)
        .set('Authorization', `Bearer ${customer.token}`)
        .send({
          password: 'EvePassword123!',
          _testFailureAfterBalanceUpdate: true,
        });

      expect(confirmRes.status).toBe(500);

      // Balances must remain unchanged
      const [custWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, customer.wallet.id));
      expect(Number(custWallet.balance)).toBe(150000);

      const [merchWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, merchant.wallet.id));
      expect(Number(merchWallet.balance)).toBe(50000);

      // Payment request must remain pending
      const [req] = await db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.code, code));
      expect(req.status).toBe('pending');

      // Transactions must remain empty
      const txRows = await db.select().from(transactions);
      expect(txRows.length).toBe(0);
    });

    it('preserves the total platform balance conservation invariant (Plan Acceptance checks 5, 7, 13)', async () => {
      const merchant = await createUser({
        name: 'Stationery World',
        phone: '0558000001',
        role: 'merchant',
        initialBalance: 120000, // 1,200 DA
      });
      const customer1 = await createUser({
        name: 'Frank',
        phone: '0558000002',
        role: 'customer',
        initialBalance: 300000, // 3,000 DA
        password: 'FrankPassword123!',
      });
      const customer2 = await createUser({
        name: 'Grace',
        phone: '0558000003',
        role: 'customer',
        initialBalance: 450000, // 4,500 DA
        password: 'GracePassword123!',
      });

      // Sum of all balances before payments
      const [initialSumRow] = await db
        .select({ total: sql`sum(${wallets.balance})` })
        .from(wallets);
      const initialTotalCentimes = Number(initialSumRow.total);
      expect(initialTotalCentimes).toBe(120000 + 300000 + 450000); // 870,000 centimes

      // Payment 1: Frank pays 1,000 DA
      const genRes1 = await request(app)
        .post('/api/merchant/payment-requests')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ amountDinars: 1000 });

      const confirmRes1 = await request(app)
        .post(`/api/customer/payment-requests/${genRes1.body.code}/confirm`)
        .set('Authorization', `Bearer ${customer1.token}`)
        .send({ password: 'FrankPassword123!' });

      expect(confirmRes1.status).toBe(200);

      // Payment 2: Grace pays 2,500 DA
      const genRes2 = await request(app)
        .post('/api/merchant/payment-requests')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ amountDinars: 2500 });

      const confirmRes2 = await request(app)
        .post(`/api/customer/payment-requests/${genRes2.body.code}/confirm`)
        .set('Authorization', `Bearer ${customer2.token}`)
        .send({ password: 'GracePassword123!' });

      expect(confirmRes2.status).toBe(200);

      // Sum of all balances after payments
      const [finalSumRow] = await db
        .select({ total: sql`sum(${wallets.balance})` })
        .from(wallets);
      const finalTotalCentimes = Number(finalSumRow.total);

      // Conservation invariant: sum of balances before === sum of balances after
      expect(finalTotalCentimes).toBe(initialTotalCentimes);
    });
  });

  describe('Customer History Integration', () => {
    it('completed payment appears in GET /api/customer/transactions as outgoing with merchant counterparty', async () => {
      const merchant = await createUser({
        name: 'Super Epic Market',
        phone: '0559000001',
        role: 'merchant',
        initialBalance: 0,
      });
      const customer = await createUser({
        name: 'Hannah',
        phone: '0559000002',
        role: 'customer',
        initialBalance: 500000,
        password: 'HannahPass123!',
      });

      // Merchant creates code for 2,200 DA
      const genRes = await request(app)
        .post('/api/merchant/payment-requests')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ amountDinars: 2200 });

      // Customer confirms
      const confirmRes = await request(app)
        .post(`/api/customer/payment-requests/${genRes.body.code}/confirm`)
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ password: 'HannahPass123!' });

      expect(confirmRes.status).toBe(200);

      // Check customer transaction history
      const historyRes = await request(app)
        .get('/api/customer/transactions')
        .set('Authorization', `Bearer ${customer.token}`);

      expect(historyRes.status).toBe(200);
      expect(Array.isArray(historyRes.body)).toBe(true);
      expect(historyRes.body.length).toBe(1);

      const historyItem = historyRes.body[0];
      expect(historyItem).toEqual({
        id: confirmRes.body.transaction.id,
        type: 'payment',
        amountCentimes: 220000,
        amountDinars: 2200,
        direction: 'out',
        status: 'completed',
        description: 'Payment to Super Epic Market',
        createdAt: expect.any(String),
        counterparty: {
          name: 'Super Epic Market',
          phone: '0559000001',
        },
      });
    });
  });
});
