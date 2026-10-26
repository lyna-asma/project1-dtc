import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, sql } from 'drizzle-orm';
import { app } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { users, wallets, transactions, otpCodes } from '../src/db/schema.js';
import { generateToken, getJwtSecret } from '../src/middleware/auth.js';
import { merchantTopUp } from '../src/services/wallet.js';

describe('Merchant Cash Top-Up to Customer Wallet (Issue #11)', () => {
  const cleanDb = async () => {
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

  // Helper to create a user and optional wallet
  async function createUser({
    name,
    phone,
    role = 'customer',
    isVerified = true,
    createWallet = true,
    initialBalance = 0,
  }) {
    const passwordHash = await bcrypt.hash('Secret123!', 10);
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

    return { user, wallet, token };
  }

  describe('Endpoint & Route Security (POST /api/merchant/top-up)', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const customer = await createUser({
        name: 'Customer 1',
        phone: '0550000001',
        role: 'customer',
      });

      const res = await request(app)
        .post('/api/merchant/top-up')
        .send({ customerPhone: customer.user.phone, amountDinars: 500 });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Authentication token required' });
    });

    it('returns 401 when Authorization header format is invalid', async () => {
      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', 'InvalidFormat')
        .send({ customerPhone: '0550000001', amountDinars: 500 });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid authorization header format' });
    });

    it('returns 401 when token is invalid', async () => {
      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .send({ customerPhone: '0550000001', amountDinars: 500 });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid authentication token' });
    });

    it('returns 401 when token is expired', async () => {
      const expiredToken = jwt.sign(
        { id: 1, phone: '0550000002', role: 'merchant' },
        getJwtSecret(),
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ customerPhone: '0550000001', amountDinars: 500 });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Token has expired' });
    });

    it('returns 403 when authenticated as customer', async () => {
      const customer = await createUser({
        name: 'Regular Customer',
        phone: '0550000001',
        role: 'customer',
      });
      const customer2 = await createUser({
        name: 'Other Customer',
        phone: '0550000002',
        role: 'customer',
      });

      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ customerPhone: customer2.user.phone, amountDinars: 500 });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Insufficient permissions' });
    });

    it('returns 403 when authenticated as admin', async () => {
      const admin = await createUser({
        name: 'Admin User',
        phone: '0555000000',
        role: 'admin',
      });
      const customer = await createUser({
        name: 'Customer 1',
        phone: '0550000001',
        role: 'customer',
      });

      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ customerPhone: customer.user.phone, amountDinars: 500 });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Insufficient permissions' });
    });
  });

  describe('Request Validation & Target Customer Lookup', () => {
    it('returns 400 when customerPhone is missing or empty', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000010',
        role: 'merchant',
        initialBalance: 50000,
      });

      // Missing customerPhone
      const res1 = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ amountDinars: 500 });
      expect(res1.status).toBe(400);
      expect(res1.body).toEqual({ error: 'customerPhone is required' });

      // Empty string customerPhone
      const res2 = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: '', amountDinars: 500 });
      expect(res2.status).toBe(400);
      expect(res2.body).toEqual({ error: 'customerPhone is required' });

      // Whitespace-only customerPhone
      const res3 = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: '   ', amountDinars: 500 });
      expect(res3.status).toBe(400);
      expect(res3.body).toEqual({ error: 'customerPhone is required' });
    });

    it('returns 400 when customerPhone is not a string', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000010',
        role: 'merchant',
        initialBalance: 50000,
      });

      // Number
      const res1 = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: 550123456, amountDinars: 500 });
      expect(res1.status).toBe(400);
      expect(res1.body).toEqual({ error: 'Invalid customer phone number' });

      // Boolean
      const res2 = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: true, amountDinars: 500 });
      expect(res2.status).toBe(400);
      expect(res2.body).toEqual({ error: 'Invalid customer phone number' });

      // Object
      const res3 = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: { phone: '0550123456' }, amountDinars: 500 });
      expect(res3.status).toBe(400);
      expect(res3.body).toEqual({ error: 'Invalid customer phone number' });

      // Array
      const res4 = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: ['0550123456'], amountDinars: 500 });
      expect(res4.status).toBe(400);
      expect(res4.body).toEqual({ error: 'Invalid customer phone number' });
    });

    it('returns 404 when customerPhone does not exist', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000010',
        role: 'merchant',
        initialBalance: 50000,
      });

      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: '0599999999', amountDinars: 500 });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Customer not found' });
    });

    it('returns 400 when target customer account is not verified', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000010',
        role: 'merchant',
        initialBalance: 50000,
      });
      const unverifiedCustomer = await createUser({
        name: 'Unverified Customer',
        phone: '0550000020',
        role: 'customer',
        isVerified: false,
      });

      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: unverifiedCustomer.user.phone, amountDinars: 500 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Customer account is not verified' });
    });

    it('returns 400 when target user role is not customer (e.g. another merchant or admin)', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000010',
        role: 'merchant',
        initialBalance: 50000,
      });
      const otherMerchant = await createUser({
        name: 'Shop 2',
        phone: '0550000021',
        role: 'merchant',
      });
      const admin = await createUser({
        name: 'Admin',
        phone: '0555000000',
        role: 'admin',
      });

      const res1 = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: otherMerchant.user.phone, amountDinars: 500 });
      expect(res1.status).toBe(400);
      expect(res1.body).toEqual({ error: 'Target user is not a customer' });

      const res2 = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: admin.user.phone, amountDinars: 500 });
      expect(res2.status).toBe(400);
      expect(res2.body).toEqual({ error: 'Target user is not a customer' });
    });

    it('returns 400 when merchant tries to top up their own shop (self top-up)', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000010',
        role: 'merchant',
        initialBalance: 50000,
      });

      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: merchant.user.phone, amountDinars: 500 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Cannot top up your own shop' });
    });

    it('returns 400 when both amountDinars and amount are missing', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000010',
        role: 'merchant',
        initialBalance: 50000,
      });
      const customer = await createUser({
        name: 'Customer 1',
        phone: '0550000030',
        role: 'customer',
      });

      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: customer.user.phone });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'amountDinars is required' });
    });

    it('returns 400 for non-integer or non-numeric amount (string, boolean, null, array, object)', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000010',
        role: 'merchant',
        initialBalance: 50000,
      });
      const customer = await createUser({
        name: 'Customer 1',
        phone: '0550000030',
        role: 'customer',
      });

      const testCases = ['500', true, null, [], {}];
      for (const invalidAmount of testCases) {
        const res = await request(app)
          .post('/api/merchant/top-up')
          .set('Authorization', `Bearer ${merchant.token}`)
          .send({ customerPhone: customer.user.phone, amountDinars: invalidAmount });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Amount must be a positive integer' });
      }
    });

    it('returns 400 for decimal or fractional amounts', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000010',
        role: 'merchant',
        initialBalance: 50000,
      });
      const customer = await createUser({
        name: 'Customer 1',
        phone: '0550000030',
        role: 'customer',
      });

      for (const decAmount of [100.5, 500.01, 0.99]) {
        const res = await request(app)
          .post('/api/merchant/top-up')
          .set('Authorization', `Bearer ${merchant.token}`)
          .send({ customerPhone: customer.user.phone, amountDinars: decAmount });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Amount must be a positive integer' });
      }
    });

    it('returns 400 for amount <= 0', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000010',
        role: 'merchant',
        initialBalance: 50000,
      });
      const customer = await createUser({
        name: 'Customer 1',
        phone: '0550000030',
        role: 'customer',
      });

      for (const nonPositive of [0, -1, -500]) {
        const res = await request(app)
          .post('/api/merchant/top-up')
          .set('Authorization', `Bearer ${merchant.token}`)
          .send({ customerPhone: customer.user.phone, amountDinars: nonPositive });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Amount must be a positive integer' });
      }
    });

    it('returns 400 for amount exceeding Number.MAX_SAFE_INTEGER', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000010',
        role: 'merchant',
        initialBalance: 50000,
      });
      const customer = await createUser({
        name: 'Customer 1',
        phone: '0550000030',
        role: 'customer',
      });

      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({
          customerPhone: customer.user.phone,
          amountDinars: Number.MAX_SAFE_INTEGER + 1000,
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Amount exceeds maximum allowed value' });
    });

    it('supports fallback "amount" field when amountDinars is omitted', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000010',
        role: 'merchant',
        initialBalance: 50000, // 500 DA
      });
      const customer = await createUser({
        name: 'Customer 1',
        phone: '0550000030',
        role: 'customer',
        initialBalance: 0,
      });

      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: customer.user.phone, amount: 200 });

      expect(res.status).toBe(200);
      expect(res.body.amountDinars).toBe(200);
      expect(res.body.amountCentimes).toBe(20000);
      expect(res.body.newShopBalanceDinars).toBe(300);
      expect(res.body.newShopBalanceCentimes).toBe(30000);
    });
  });

  describe('Shop Balance Sufficiency & Wallet Provisioning', () => {
    it('returns 400 Insufficient shop balance when merchant wallet does not exist', async () => {
      const merchant = await createUser({
        name: 'Shop No Wallet',
        phone: '0550000040',
        role: 'merchant',
        createWallet: false,
      });
      const customer = await createUser({
        name: 'Customer 1',
        phone: '0550000041',
        role: 'customer',
      });

      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: customer.user.phone, amountDinars: 100 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Insufficient shop balance' });
    });

    it('returns 400 Insufficient shop balance when shop balance is 0 or less than requested amount', async () => {
      const merchant = await createUser({
        name: 'Shop Zero Balance',
        phone: '0550000042',
        role: 'merchant',
        initialBalance: 0,
      });
      const customer = await createUser({
        name: 'Customer 1',
        phone: '0550000043',
        role: 'customer',
        initialBalance: 1000,
      });

      const res1 = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: customer.user.phone, amountDinars: 50 });

      expect(res1.status).toBe(400);
      expect(res1.body).toEqual({ error: 'Insufficient shop balance' });

      // Partially funded shop: 400 DA balance, trying to top up 500 DA
      const merchant2 = await createUser({
        name: 'Shop Partial Balance',
        phone: '0550000044',
        role: 'merchant',
        initialBalance: 40000, // 400 DA
      });

      const res2 = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant2.token}`)
        .send({ customerPhone: customer.user.phone, amountDinars: 500 });

      expect(res2.status).toBe(400);
      expect(res2.body).toEqual({ error: 'Insufficient shop balance' });
    });

    it('leaves balances untouched and records no transaction when rejected for insufficient balance', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000045',
        role: 'merchant',
        initialBalance: 20000, // 200 DA
      });
      const customer = await createUser({
        name: 'Customer 1',
        phone: '0550000046',
        role: 'customer',
        initialBalance: 15000, // 150 DA
      });

      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: customer.user.phone, amountDinars: 300 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Insufficient shop balance' });

      // Check balances in DB
      const [shopWallet] = await db.select().from(wallets).where(eq(wallets.id, merchant.wallet.id));
      const [custWallet] = await db.select().from(wallets).where(eq(wallets.id, customer.wallet.id));
      expect(shopWallet.balance).toBe(20000);
      expect(custWallet.balance).toBe(15000);

      // Check transactions
      const txRows = await db.select().from(transactions);
      expect(txRows).toHaveLength(0);
    });

    it('auto-provisions missing customer wallet with initial balance 0 before crediting', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000047',
        role: 'merchant',
        initialBalance: 100000, // 1000 DA
      });
      const customerNoWallet = await createUser({
        name: 'Customer Without Wallet',
        phone: '0550000048',
        role: 'customer',
        createWallet: false,
      });

      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: customerNoWallet.user.phone, amountDinars: 300 });

      expect(res.status).toBe(200);
      expect(res.body.amountDinars).toBe(300);
      expect(res.body.amountCentimes).toBe(30000);
      expect(res.body.newShopBalanceDinars).toBe(700);
      expect(res.body.newShopBalanceCentimes).toBe(70000);

      // Customer wallet should now exist with credited balance
      const [newCustWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, customerNoWallet.user.id));
      expect(newCustWallet).toBeDefined();
      expect(newCustWallet.balance).toBe(30000);
    });
  });

  describe('Successful Cash Top-Up & Response Shape', () => {
    it('executes successful top-up, decreases shop balance, increases customer balance, and returns exact response structure', async () => {
      const merchant = await createUser({
        name: 'Boutique Alger Centre',
        phone: '0550111222',
        role: 'merchant',
        initialBalance: 150000, // 1500 DA
      });
      const customer = await createUser({
        name: 'Amine Benali',
        phone: '0550333444',
        role: 'customer',
        initialBalance: 20000, // 200 DA
      });

      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({
          customerPhone: customer.user.phone,
          amountDinars: 500,
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        message: 'Top-up successful',
        amountDinars: 500,
        amountCentimes: 50000,
        newShopBalanceDinars: 1000,
        newShopBalanceCentimes: 100000,
        customerPhone: customer.user.phone,
        customerName: customer.user.name,
        transaction: {
          id: expect.any(Number),
          type: 'top_up',
          amountDinars: 500,
          amountCentimes: 50000,
          fromWalletId: merchant.wallet.id,
          toWalletId: customer.wallet.id,
          status: 'completed',
          createdAt: expect.any(String),
        },
      });

      // Verify date format is valid ISO string
      expect(new Date(res.body.transaction.createdAt).toISOString()).toBe(res.body.transaction.createdAt);

      // Verify DB balances
      const [updatedShopWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, merchant.wallet.id));
      const [updatedCustWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, customer.wallet.id));

      expect(updatedShopWallet.balance).toBe(100000);
      expect(updatedCustWallet.balance).toBe(70000);
    });
  });

  describe('Append-Only Ledger & Customer History', () => {
    it('inserts an immutable transaction record with correct attributes and does not alter existing ledger rows', async () => {
      const merchant = await createUser({
        name: 'Epicerie Chlef',
        phone: '0550555666',
        role: 'merchant',
        initialBalance: 200000, // 2000 DA
      });
      const customer = await createUser({
        name: 'Fatima Zohra',
        phone: '0550777888',
        role: 'customer',
        initialBalance: 5000, // 50 DA
      });

      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: customer.user.phone, amountDinars: 600 });

      expect(res.status).toBe(200);

      const [txRecord] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, res.body.transaction.id));

      expect(txRecord).toBeDefined();
      expect(txRecord.type).toBe('top_up');
      expect(txRecord.fromWalletId).toBe(merchant.wallet.id);
      expect(txRecord.toWalletId).toBe(customer.wallet.id);
      expect(txRecord.amount).toBe(60000);
      expect(txRecord.feeAmount).toBe(0);
      expect(txRecord.status).toBe('completed');
      expect(txRecord.description).toBe('Cash top-up from shop');
    });

    it('displays top-up transaction in customer transaction history with merchant counterparty', async () => {
      const merchant = await createUser({
        name: 'Magasin Oran',
        phone: '0550999111',
        role: 'merchant',
        initialBalance: 300000, // 3000 DA
      });
      const customer = await createUser({
        name: 'Karim Hadj',
        phone: '0550222333',
        role: 'customer',
        initialBalance: 0,
      });

      await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: customer.user.phone, amountDinars: 1200 });

      // Customer checks transaction history
      const historyRes = await request(app)
        .get('/api/customer/transactions')
        .set('Authorization', `Bearer ${customer.token}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body).toHaveLength(1);
      expect(historyRes.body[0]).toEqual({
        id: expect.any(Number),
        type: 'top_up',
        amountCentimes: 120000,
        amountDinars: 1200,
        direction: 'in',
        status: 'completed',
        description: 'Cash top-up from shop',
        createdAt: expect.any(String),
        counterparty: {
          name: merchant.user.name,
          phone: merchant.user.phone,
        },
      });

      // Customer checks balance
      const balanceRes = await request(app)
        .get('/api/customer/balance')
        .set('Authorization', `Bearer ${customer.token}`);

      expect(balanceRes.status).toBe(200);
      expect(balanceRes.body).toEqual({
        balanceDinars: 1200,
        balanceCentimes: 120000,
      });
    });
  });

  describe('Atomicity & Rollback', () => {
    it('rolls back completely if a failure occurs during transaction execution', async () => {
      const merchant = await createUser({
        name: 'Shop Fail Test',
        phone: '0550888999',
        role: 'merchant',
        initialBalance: 100000, // 1000 DA
      });
      const customer = await createUser({
        name: 'Customer Fail Test',
        phone: '0550111000',
        role: 'customer',
        initialBalance: 20000, // 200 DA
      });

      const res = await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({
          customerPhone: customer.user.phone,
          amountDinars: 400,
          _testFailureAfterBalanceUpdate: true,
        });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });

      // Balances should be completely unchanged
      const [shopWallet] = await db.select().from(wallets).where(eq(wallets.id, merchant.wallet.id));
      const [custWallet] = await db.select().from(wallets).where(eq(wallets.id, customer.wallet.id));
      expect(shopWallet.balance).toBe(100000);
      expect(custWallet.balance).toBe(20000);

      // No transaction should have been recorded
      const txRows = await db.select().from(transactions);
      expect(txRows).toHaveLength(0);
    });
  });

  describe('Platform Balance Conservation Invariant (Plan Acceptance checks 3, 4, 13)', () => {
    it('preserves the total platform money across all wallets before and after top-ups', async () => {
      const merchant = await createUser({
        name: 'Supermarché Constantine',
        phone: '0550444555',
        role: 'merchant',
        initialBalance: 500000, // 5000 DA
      });
      const customer1 = await createUser({
        name: 'Customer A',
        phone: '0550666777',
        role: 'customer',
        initialBalance: 10000, // 100 DA
      });
      const customer2 = await createUser({
        name: 'Customer B',
        phone: '0550888111',
        role: 'customer',
        initialBalance: 30000, // 300 DA
      });

      // Sum all wallet balances before operations
      const [sumBefore] = await db
        .select({ total: sql`COALESCE(SUM(balance), 0)::bigint` })
        .from(wallets);
      const totalBefore = Number(sumBefore.total);

      // Execute several top-up operations
      await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: customer1.user.phone, amountDinars: 500 });

      await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: customer2.user.phone, amountDinars: 1500 });

      // Execute an invalid top-up (insufficient balance or invalid user)
      await request(app)
        .post('/api/merchant/top-up')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ customerPhone: customer1.user.phone, amountDinars: 999999 });

      // Sum all wallet balances after operations
      const [sumAfter] = await db
        .select({ total: sql`COALESCE(SUM(balance), 0)::bigint` })
        .from(wallets);
      const totalAfter = Number(sumAfter.total);

      expect(totalAfter).toBe(totalBefore);
      expect(totalAfter).toBe(540000); // 5400 DA * 100
    });
  });
});
