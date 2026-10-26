import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { app } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { users, wallets, transactions, otpCodes } from '../src/db/schema.js';
import { generateToken, getJwtSecret } from '../src/middleware/auth.js';
import { recordTransaction } from '../src/services/wallet.js';

describe('Wallet Schema, Append-Only Ledger, and Customer History (Issue #9)', () => {
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

  // Helper to create a user and wallet
  async function createUserAndWallet({
    name,
    phone,
    role = 'customer',
    balance = 0,
    isVerified = true,
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

    const [wallet] = await db
      .insert(wallets)
      .values({
        userId: user.id,
        balance,
      })
      .returning();

    const token = generateToken({
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
    });

    return { user, wallet, token };
  }

  describe('Database Constraints & Ledger Schema', () => {
    it('enforces CHECK (balance >= 0) and rejects negative balances', async () => {
      const { wallet } = await createUserAndWallet({
        name: 'Negative Balance Test',
        phone: '0550000001',
        balance: 1000,
      });

      // Attempting to set balance to -1 should be rejected by PostgreSQL CHECK constraint
      await expect(
        db.update(wallets).set({ balance: -1 }).where(eq(wallets.id, wallet.id))
      ).rejects.toThrow();
    });

    it('enforces CHECK (amount > 0) on transactions table', async () => {
      const { wallet } = await createUserAndWallet({
        name: 'Tx Positive Amount Test',
        phone: '0550000002',
        balance: 5000,
      });

      // Amount = 0 must fail
      await expect(
        db.insert(transactions).values({
          type: 'top_up',
          toWalletId: wallet.id,
          amount: 0,
        })
      ).rejects.toThrow();

      // Negative amount must fail
      await expect(
        db.insert(transactions).values({
          type: 'top_up',
          toWalletId: wallet.id,
          amount: -500,
        })
      ).rejects.toThrow();
    });

    it('enforces foreign key constraints on from_wallet_id and to_wallet_id', async () => {
      // Non-existent wallet ID (999999) must fail foreign key check
      await expect(
        db.insert(transactions).values({
          type: 'top_up',
          fromWalletId: 999999,
          amount: 1000,
        })
      ).rejects.toThrow();

      await expect(
        db.insert(transactions).values({
          type: 'top_up',
          toWalletId: 999999,
          amount: 1000,
        })
      ).rejects.toThrow();
    });

    it('allows inserting transactions with null from_wallet_id or to_wallet_id', async () => {
      const { wallet } = await createUserAndWallet({
        name: 'Admin Load Test',
        phone: '0550000003',
        balance: 5000,
      });

      // System / Admin load has null fromWalletId
      const [tx] = await db
        .insert(transactions)
        .values({
          type: 'admin_load',
          fromWalletId: null,
          toWalletId: wallet.id,
          amount: 500000,
          description: 'Initial admin allocation',
        })
        .returning();

      expect(tx).toBeDefined();
      expect(tx.fromWalletId).toBeNull();
      expect(tx.toWalletId).toBe(wallet.id);
      expect(Number(tx.amount)).toBe(500000);
      expect(tx.status).toBe('completed');
    });
  });

  describe('GET /api/customer/balance', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/customer/balance');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Authentication token required' });
    });

    it('returns 401 when token is invalid or expired', async () => {
      const resInvalid = await request(app)
        .get('/api/customer/balance')
        .set('Authorization', 'Bearer invalid-token-string');
      expect(resInvalid.status).toBe(401);

      const expiredToken = jwt.sign(
        { id: 1, phone: '0550000000', role: 'customer' },
        getJwtSecret(),
        { expiresIn: '-1s' }
      );
      const resExpired = await request(app)
        .get('/api/customer/balance')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(resExpired.status).toBe(401);
      expect(resExpired.body).toEqual({ error: 'Token has expired' });
    });

    it('returns 403 when authenticated as a merchant', async () => {
      const { token } = await createUserAndWallet({
        name: 'Merchant User',
        phone: '0550000004',
        role: 'merchant',
      });

      const res = await request(app)
        .get('/api/customer/balance')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Insufficient permissions' });
    });

    it('returns 403 when authenticated as an admin', async () => {
      const { token } = await createUserAndWallet({
        name: 'Admin User',
        phone: '0550000005',
        role: 'admin',
      });

      const res = await request(app)
        .get('/api/customer/balance')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Insufficient permissions' });
    });

    it('returns HTTP 200 with { balanceDinars: 0, balanceCentimes: 0 } for a newly registered customer', async () => {
      const { token } = await createUserAndWallet({
        name: 'New Customer',
        phone: '0550000006',
        role: 'customer',
        balance: 0,
      });

      const res = await request(app)
        .get('/api/customer/balance')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        balanceDinars: 0,
        balanceCentimes: 0,
      });
    });

    it('computes dinars without floating-point math using integer division', async () => {
      // 1,250 centimes = 12 DA and 50 centimes -> integer dinars is 12
      const { token } = await createUserAndWallet({
        name: 'Funded Customer',
        phone: '0550000007',
        role: 'customer',
        balance: 1250,
      });

      const res = await request(app)
        .get('/api/customer/balance')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        balanceDinars: 12,
        balanceCentimes: 1250,
      });
    });

    it('handles large centimes balances cleanly', async () => {
      // 200,000 DA = 20,000,000 centimes
      const { token } = await createUserAndWallet({
        name: 'Max Balance Customer',
        phone: '0550000008',
        role: 'customer',
        balance: 20000000,
      });

      const res = await request(app)
        .get('/api/customer/balance')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        balanceDinars: 200000,
        balanceCentimes: 20000000,
      });
    });
  });

  describe('GET /api/customer/transactions', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/customer/transactions');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Authentication token required' });
    });

    it('returns 403 when authenticated as a non-customer role (merchant or admin)', async () => {
      const { token: merchantToken } = await createUserAndWallet({
        name: 'Merchant For Tx',
        phone: '0550000009',
        role: 'merchant',
      });
      const resMerchant = await request(app)
        .get('/api/customer/transactions')
        .set('Authorization', `Bearer ${merchantToken}`);
      expect(resMerchant.status).toBe(403);
      expect(resMerchant.body).toEqual({ error: 'Insufficient permissions' });

      const { token: adminToken } = await createUserAndWallet({
        name: 'Admin For Tx',
        phone: '0550000010',
        role: 'admin',
      });
      const resAdmin = await request(app)
        .get('/api/customer/transactions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(403);
      expect(resAdmin.body).toEqual({ error: 'Insufficient permissions' });
    });

    it('returns an empty array [] when customer has no transactions', async () => {
      const { token } = await createUserAndWallet({
        name: 'Zero Tx Customer',
        phone: '0550000011',
        role: 'customer',
      });

      const res = await request(app)
        .get('/api/customer/transactions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns transactions sorted newest first (created_at DESC, id DESC)', async () => {
      const customer = await createUserAndWallet({
        name: 'History Customer',
        phone: '0550000012',
        role: 'customer',
      });

      const merchant = await createUserAndWallet({
        name: 'History Merchant',
        phone: '0550000013',
        role: 'merchant',
      });

      // Insert 3 transactions with different timestamps
      const tx1 = await recordTransaction({
        type: 'top_up',
        fromWalletId: merchant.wallet.id,
        toWalletId: customer.wallet.id,
        amount: 100000,
        description: 'First top up',
      });

      const tx2 = await recordTransaction({
        type: 'payment',
        fromWalletId: customer.wallet.id,
        toWalletId: merchant.wallet.id,
        amount: 25000,
        description: 'Payment for groceries',
      });

      const tx3 = await recordTransaction({
        type: 'top_up',
        fromWalletId: merchant.wallet.id,
        toWalletId: customer.wallet.id,
        amount: 50000,
        description: 'Second top up',
      });

      const res = await request(app)
        .get('/api/customer/transactions')
        .set('Authorization', `Bearer ${customer.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(3);

      // Verify descending order by id and timestamp
      expect(res.body[0].id).toBe(tx3.id);
      expect(res.body[1].id).toBe(tx2.id);
      expect(res.body[2].id).toBe(tx1.id);
    });

    it('formats transaction fields and computes direction correctly ("in" vs "out")', async () => {
      const customerA = await createUserAndWallet({
        name: 'Customer Alice',
        phone: '0550000014',
        role: 'customer',
      });

      const customerB = await createUserAndWallet({
        name: 'Customer Bob',
        phone: '0550000015',
        role: 'customer',
      });

      // Transaction 1: Alice sends to Bob (Alice is sender -> direction "out")
      const txSend = await recordTransaction({
        type: 'transfer',
        fromWalletId: customerA.wallet.id,
        toWalletId: customerB.wallet.id,
        amount: 15000, // 150 DA
        description: 'Lunch split',
      });

      // Transaction 2: System admin load to Alice (Alice is receiver -> direction "in", null counterparty)
      const txLoad = await recordTransaction({
        type: 'admin_load',
        fromWalletId: null,
        toWalletId: customerA.wallet.id,
        amount: 50000, // 500 DA
        description: 'Promo credit',
      });

      const res = await request(app)
        .get('/api/customer/transactions')
        .set('Authorization', `Bearer ${customerA.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);

      // Most recent is txLoad (admin_load)
      const loadItem = res.body[0];
      expect(loadItem).toEqual({
        id: txLoad.id,
        type: 'admin_load',
        amountCentimes: 50000,
        amountDinars: 500,
        direction: 'in',
        status: 'completed',
        description: 'Promo credit',
        createdAt: expect.any(String),
        counterparty: null,
      });

      // Older is txSend (Alice -> Bob)
      const sendItem = res.body[1];
      expect(sendItem).toEqual({
        id: txSend.id,
        type: 'transfer',
        amountCentimes: 15000,
        amountDinars: 150,
        direction: 'out',
        status: 'completed',
        description: 'Lunch split',
        createdAt: expect.any(String),
        counterparty: {
          name: 'Customer Bob',
          phone: '0550000015',
        },
      });

      // Verify that Bob sees the transfer as "in" from Alice
      const resBob = await request(app)
        .get('/api/customer/transactions')
        .set('Authorization', `Bearer ${customerB.token}`);

      expect(resBob.status).toBe(200);
      expect(resBob.body).toHaveLength(1);
      expect(resBob.body[0]).toEqual({
        id: txSend.id,
        type: 'transfer',
        amountCentimes: 15000,
        amountDinars: 150,
        direction: 'in',
        status: 'completed',
        description: 'Lunch split',
        createdAt: expect.any(String),
        counterparty: {
          name: 'Customer Alice',
          phone: '0550000014',
        },
      });
    });

    it('enforces strict cross-customer data isolation', async () => {
      const customerA = await createUserAndWallet({
        name: 'Isolated Alice',
        phone: '0550000016',
        role: 'customer',
      });

      const customerB = await createUserAndWallet({
        name: 'Isolated Bob',
        phone: '0550000017',
        role: 'customer',
      });

      const merchantC = await createUserAndWallet({
        name: 'Merchant Charlie',
        phone: '0550000018',
        role: 'merchant',
      });

      // Transaction between Bob and Charlie (Alice is NOT involved)
      await recordTransaction({
        type: 'payment',
        fromWalletId: customerB.wallet.id,
        toWalletId: merchantC.wallet.id,
        amount: 30000,
        description: 'Payment for shoes',
      });

      // Transaction where Alice IS involved
      const aliceTx = await recordTransaction({
        type: 'transfer',
        fromWalletId: customerA.wallet.id,
        toWalletId: customerB.wallet.id,
        amount: 1000,
        description: 'Small transfer',
      });

      const resAlice = await request(app)
        .get('/api/customer/transactions')
        .set('Authorization', `Bearer ${customerA.token}`);

      expect(resAlice.status).toBe(200);
      // Alice must ONLY see the transaction she is part of
      expect(resAlice.body).toHaveLength(1);
      expect(resAlice.body[0].id).toBe(aliceTx.id);
    });

    it('returns null counterparty when counterparty wallet is null', async () => {
      const customer = await createUserAndWallet({
        name: 'Null Counterparty Customer',
        phone: '0550000019',
        role: 'customer',
      });

      await recordTransaction({
        type: 'admin_load',
        fromWalletId: null,
        toWalletId: customer.wallet.id,
        amount: 200000,
        description: 'System adjustment',
      });

      const res = await request(app)
        .get('/api/customer/transactions')
        .set('Authorization', `Bearer ${customer.token}`);

      expect(res.status).toBe(200);
      expect(res.body[0].counterparty).toBeNull();
    });
  });
});
