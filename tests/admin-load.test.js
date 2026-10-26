import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, sql } from 'drizzle-orm';
import { app } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { users, wallets, transactions, otpCodes } from '../src/db/schema.js';
import { generateToken, getJwtSecret } from '../src/middleware/auth.js';
import { adminLoadShopBalance } from '../src/services/wallet.js';

describe('Admin Shop Balance Loading (Issue #10)', () => {
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

  describe('Endpoint & Route Security (POST /api/admin/shops/:merchantId/load)', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000001',
        role: 'merchant',
      });

      const res = await request(app)
        .post(`/api/admin/shops/${merchant.user.id}/load`)
        .send({ amountDinars: 1000 });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Authentication token required' });
    });

    it('returns 401 when Authorization token is invalid', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000001',
        role: 'merchant',
      });

      const res = await request(app)
        .post(`/api/admin/shops/${merchant.user.id}/load`)
        .set('Authorization', 'Bearer invalid-token')
        .send({ amountDinars: 1000 });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid authentication token' });
    });

    it('returns 401 when Authorization token has expired', async () => {
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000001',
        role: 'merchant',
      });

      const expiredToken = jwt.sign(
        { id: 99, phone: '0555000000', role: 'admin' },
        getJwtSecret(),
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .post(`/api/admin/shops/${merchant.user.id}/load`)
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ amountDinars: 1000 });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Token has expired' });
    });

    it('returns 403 when called with a valid customer token', async () => {
      const customer = await createUser({
        name: 'Customer 1',
        phone: '0550000002',
        role: 'customer',
      });
      const merchant = await createUser({
        name: 'Shop 1',
        phone: '0550000001',
        role: 'merchant',
      });

      const res = await request(app)
        .post(`/api/admin/shops/${merchant.user.id}/load`)
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ amountDinars: 1000 });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Insufficient permissions' });
    });

    it('returns 403 when called with a valid merchant token', async () => {
      const merchantCaller = await createUser({
        name: 'Caller Shop',
        phone: '0550000003',
        role: 'merchant',
      });
      const targetMerchant = await createUser({
        name: 'Target Shop',
        phone: '0550000004',
        role: 'merchant',
      });

      const res = await request(app)
        .post(`/api/admin/shops/${targetMerchant.user.id}/load`)
        .set('Authorization', `Bearer ${merchantCaller.token}`)
        .send({ amountDinars: 1000 });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Insufficient permissions' });
    });
  });

  describe('Request Validation & Merchant Lookup', () => {
    let adminToken;
    let merchant;

    beforeEach(async () => {
      const admin = await createUser({
        name: 'Platform Admin',
        phone: '0555000000',
        role: 'admin',
      });
      adminToken = admin.token;

      merchant = await createUser({
        name: 'Algiers Superette',
        phone: '0550112233',
        role: 'merchant',
      });
    });

    it('rejects non-integer and non-numeric merchantId values with 400', async () => {
      const invalidIds = ['abc', '1.5', '-3', '0'];
      for (const invalidId of invalidIds) {
        const res = await request(app)
          .post(`/api/admin/shops/${invalidId}/load`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ amountDinars: 500 });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Invalid merchant ID' });
      }
    });

    it('returns 404 when merchantId does not exist in users', async () => {
      const res = await request(app)
        .post('/api/admin/shops/999999/load')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amountDinars: 500 });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Merchant not found' });
    });

    it('returns 400 when target user role is not merchant (customer)', async () => {
      const customer = await createUser({
        name: 'Plain Customer',
        phone: '0550445566',
        role: 'customer',
      });

      const res = await request(app)
        .post(`/api/admin/shops/${customer.user.id}/load`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amountDinars: 500 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Target user is not a merchant' });
    });

    it('returns 400 when target user role is not merchant (admin)', async () => {
      const otherAdmin = await createUser({
        name: 'Other Admin',
        phone: '0555999999',
        role: 'admin',
      });

      const res = await request(app)
        .post(`/api/admin/shops/${otherAdmin.user.id}/load`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amountDinars: 500 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Target user is not a merchant' });
    });

    it('returns 400 when amountDinars is missing', async () => {
      const res = await request(app)
        .post(`/api/admin/shops/${merchant.user.id}/load`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'No amount provided' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'amountDinars is required' });
    });

    it('returns 400 when amountDinars is non-integer or non-numeric', async () => {
      const invalidAmounts = ['5000', true, null, [], {}];
      for (const amount of invalidAmounts) {
        const res = await request(app)
          .post(`/api/admin/shops/${merchant.user.id}/load`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ amountDinars: amount });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'amountDinars must be a positive integer' });
      }
    });

    it('returns 400 when amountDinars is decimal / fractional', async () => {
      const fractionalAmounts = [100.5, 500.01];
      for (const amount of fractionalAmounts) {
        const res = await request(app)
          .post(`/api/admin/shops/${merchant.user.id}/load`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ amountDinars: amount });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'amountDinars must be a positive integer' });
      }
    });

    it('returns 400 when amountDinars is less than or equal to zero', async () => {
      const nonPositiveAmounts = [0, -100];
      for (const amount of nonPositiveAmounts) {
        const res = await request(app)
          .post(`/api/admin/shops/${merchant.user.id}/load`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ amountDinars: amount });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'amountDinars must be a positive integer' });
      }
    });

    it('returns 400 when amountDinars exceeds Number.MAX_SAFE_INTEGER', async () => {
      const res = await request(app)
        .post(`/api/admin/shops/${merchant.user.id}/load`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amountDinars: Number.MAX_SAFE_INTEGER + 1000 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'amountDinars exceeds maximum allowed value' });
    });
  });

  describe('Wallet Handling, Balance Credit & Response Shape', () => {
    let adminToken;

    beforeEach(async () => {
      const admin = await createUser({
        name: 'Platform Admin',
        phone: '0555000000',
        role: 'admin',
      });
      adminToken = admin.token;
    });

    it('automatically creates a wallet with balance 0 before crediting when merchant has no wallet', async () => {
      const merchantWithoutWallet = await createUser({
        name: 'No Wallet Merchant',
        phone: '0550111222',
        role: 'merchant',
        createWallet: false,
      });

      // Confirm no wallet exists beforehand
      const existingWallet = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, merchantWithoutWallet.user.id));
      expect(existingWallet).toHaveLength(0);

      const res = await request(app)
        .post(`/api/admin/shops/${merchantWithoutWallet.user.id}/load`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amountDinars: 500,
          description: 'Initial shop float',
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        message: 'Shop balance loaded successfully',
        transaction: {
          id: expect.any(Number),
          type: 'admin_load',
          amountDinars: 500,
          amountCentimes: 50000,
          toWalletId: expect.any(Number),
          createdAt: expect.any(String),
        },
        shop: {
          id: merchantWithoutWallet.user.id,
          name: 'No Wallet Merchant',
          phone: '0550111222',
          balanceDinars: 500,
          balanceCentimes: 50000,
        },
      });

      // Verify DB wallet record was created and credited
      const [walletInDb] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, merchantWithoutWallet.user.id));
      expect(walletInDb).toBeDefined();
      expect(Number(walletInDb.balance)).toBe(50000);
      expect(res.body.transaction.toWalletId).toBe(walletInDb.id);
    });

    it('increments existing wallet balance by amountDinars * 100 without floating-point conversion', async () => {
      const merchant = await createUser({
        name: 'Existing Wallet Merchant',
        phone: '0550333444',
        role: 'merchant',
        initialBalance: 25000, // 250 Dinars
      });

      const res = await request(app)
        .post(`/api/admin/shops/${merchant.user.id}/load`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amountDinars: 1000, // +1000 Dinars (100,000 centimes)
          description: 'Top-up float',
        });

      expect(res.status).toBe(200);
      expect(res.body.shop).toEqual({
        id: merchant.user.id,
        name: 'Existing Wallet Merchant',
        phone: '0550333444',
        balanceDinars: 1250, // 250 + 1000
        balanceCentimes: 125000, // 25000 + 100000
      });

      expect(res.body.shop.balanceDinars).toBe(Math.floor(res.body.shop.balanceCentimes / 100));

      const [walletInDb] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, merchant.wallet.id));
      expect(Number(walletInDb.balance)).toBe(125000);
    });

    it('defaults transaction description to "Admin shop balance load" if omitted', async () => {
      const merchant = await createUser({
        name: 'Default Description Shop',
        phone: '0550555666',
        role: 'merchant',
      });

      const res = await request(app)
        .post(`/api/admin/shops/${merchant.user.id}/load`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amountDinars: 300 });

      expect(res.status).toBe(200);

      const [txInDb] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, res.body.transaction.id));

      expect(txInDb.description).toBe('Admin shop balance load');
    });

    it('preserves custom description in ledger record', async () => {
      const merchant = await createUser({
        name: 'Custom Desc Shop',
        phone: '0550777888',
        role: 'merchant',
      });

      const res = await request(app)
        .post(`/api/admin/shops/${merchant.user.id}/load`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amountDinars: 750,
          description: 'Monthly operational liquidity grant',
        });

      expect(res.status).toBe(200);

      const [txInDb] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, res.body.transaction.id));

      expect(txInDb.description).toBe('Monthly operational liquidity grant');
    });
  });

  describe('Ledger Record & Immutability', () => {
    let adminToken;
    let merchant;

    beforeEach(async () => {
      const admin = await createUser({
        name: 'Platform Admin',
        phone: '0555000000',
        role: 'admin',
      });
      adminToken = admin.token;

      merchant = await createUser({
        name: 'Ledger Audit Shop',
        phone: '0550999111',
        role: 'merchant',
      });
    });

    it('inserts an immutable ledger record with exact required fields', async () => {
      const res = await request(app)
        .post(`/api/admin/shops/${merchant.user.id}/load`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amountDinars: 2000,
          description: 'Ledger audit load',
        });

      expect(res.status).toBe(200);

      const [tx] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, res.body.transaction.id));

      expect(tx).toBeDefined();
      expect(tx.type).toBe('admin_load');
      expect(tx.fromWalletId).toBeNull();
      expect(tx.toWalletId).toBe(merchant.wallet.id);
      expect(Number(tx.amount)).toBe(200000);
      expect(Number(tx.feeAmount)).toBe(0);
      expect(tx.status).toBe('completed');
      expect(tx.description).toBe('Ledger audit load');
      expect(tx.createdAt).toBeInstanceOf(Date);
    });

    it('performs only INSERT operations and preserves existing ledger entries', async () => {
      // Perform first load
      const res1 = await request(app)
        .post(`/api/admin/shops/${merchant.user.id}/load`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amountDinars: 1000, description: 'First load' });
      expect(res1.status).toBe(200);

      // Perform second load
      const res2 = await request(app)
        .post(`/api/admin/shops/${merchant.user.id}/load`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amountDinars: 2000, description: 'Second load' });
      expect(res2.status).toBe(200);

      // Verify both transactions exist unchanged
      const allTx = await db
        .select()
        .from(transactions)
        .where(eq(transactions.toWalletId, merchant.wallet.id));

      expect(allTx).toHaveLength(2);
      expect(Number(allTx[0].amount)).toBe(100000);
      expect(allTx[0].description).toBe('First load');
      expect(Number(allTx[1].amount)).toBe(200000);
      expect(allTx[1].description).toBe('Second load');
    });
  });

  describe('Atomicity & Rollback', () => {
    it('rolls back completely if a failure occurs during transaction execution', async () => {
      const admin = await createUser({
        name: 'Platform Admin',
        phone: '0555000000',
        role: 'admin',
      });

      const initialBalance = 50000; // 500 Dinars
      const merchant = await createUser({
        name: 'Rollback Shop',
        phone: '0550123987',
        role: 'merchant',
        initialBalance,
      });

      // Attempt to load balance with simulated failure triggered after wallet balance update
      const res = await request(app)
        .post(`/api/admin/shops/${merchant.user.id}/load`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          amountDinars: 1000,
          description: 'Failing load',
          _testFailureAfterBalanceUpdate: true,
        });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });

      // Verify wallet balance remained completely unchanged in DB
      const [walletInDb] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, merchant.wallet.id));
      expect(Number(walletInDb.balance)).toBe(initialBalance);

      // Verify NO transaction record was created in the ledger
      const txRows = await db
        .select()
        .from(transactions)
        .where(eq(transactions.toWalletId, merchant.wallet.id));
      expect(txRows).toHaveLength(0);
    });

    it('service adminLoadShopBalance rolls back and throws when an error occurs inside tx', async () => {
      const merchant = await createUser({
        name: 'Service Rollback Shop',
        phone: '0550987123',
        role: 'merchant',
        initialBalance: 10000,
      });

      await expect(
        adminLoadShopBalance({
          merchantId: merchant.user.id,
          amountDinars: 500,
          _testFailureAfterBalanceUpdate: true,
        })
      ).rejects.toThrow('Simulated failure after balance update');

      const [walletInDb] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, merchant.wallet.id));
      expect(Number(walletInDb.balance)).toBe(10000);
    });
  });

  describe('Platform Conservation Invariant (Plan Acceptance check 13)', () => {
    it('maintains sum of all wallet balances equal to total admin loaded money across multiple shops', async () => {
      const admin = await createUser({
        name: 'Platform Admin',
        phone: '0555000000',
        role: 'admin',
      });

      // Create 3 separate merchant shops with 0 initial balance
      const shopA = await createUser({
        name: 'Shop Bab El Oued',
        phone: '0550100001',
        role: 'merchant',
        initialBalance: 0,
      });

      const shopB = await createUser({
        name: 'Shop Didouche',
        phone: '0550100002',
        role: 'merchant',
        initialBalance: 0,
      });

      const shopC = await createUser({
        name: 'Shop Hydra',
        phone: '0550100003',
        role: 'merchant',
        initialBalance: 0,
      });

      // Helper to compute total platform balance
      const getPlatformTotalWalletBalance = async () => {
        const [result] = await db
          .select({
            total: sql`COALESCE(SUM(${wallets.balance}), 0)`,
          })
          .from(wallets);
        return Number(result.total);
      };

      // Helper to compute total admin loaded money
      const getTotalAdminLoadedMoney = async () => {
        const [result] = await db
          .select({
            total: sql`COALESCE(SUM(${transactions.amount}), 0)`,
          })
          .from(transactions)
          .where(eq(transactions.type, 'admin_load'));
        return Number(result.total);
      };

      // Invariant check #0: Initial state (both must be 0)
      expect(await getPlatformTotalWalletBalance()).toBe(0);
      expect(await getTotalAdminLoadedMoney()).toBe(0);

      // Sequential Load 1: Shop A + 5,000 Dinars (500,000 centimes)
      await request(app)
        .post(`/api/admin/shops/${shopA.user.id}/load`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ amountDinars: 5000 })
        .expect(200);

      expect(await getPlatformTotalWalletBalance()).toBe(500000);
      expect(await getTotalAdminLoadedMoney()).toBe(500000);
      expect(await getPlatformTotalWalletBalance()).toBe(await getTotalAdminLoadedMoney());

      // Sequential Load 2: Shop B + 12,000 Dinars (1,200,000 centimes)
      await request(app)
        .post(`/api/admin/shops/${shopB.user.id}/load`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ amountDinars: 12000 })
        .expect(200);

      expect(await getPlatformTotalWalletBalance()).toBe(1700000);
      expect(await getTotalAdminLoadedMoney()).toBe(1700000);
      expect(await getPlatformTotalWalletBalance()).toBe(await getTotalAdminLoadedMoney());

      // Sequential Load 3: Shop A + 2,500 Dinars (250,000 centimes)
      await request(app)
        .post(`/api/admin/shops/${shopA.user.id}/load`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ amountDinars: 2500 })
        .expect(200);

      expect(await getPlatformTotalWalletBalance()).toBe(1950000);
      expect(await getTotalAdminLoadedMoney()).toBe(1950000);
      expect(await getPlatformTotalWalletBalance()).toBe(await getTotalAdminLoadedMoney());

      // Sequential Load 4: Shop C + 50,000 Dinars (5,000,000 centimes)
      await request(app)
        .post(`/api/admin/shops/${shopC.user.id}/load`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ amountDinars: 50000 })
        .expect(200);

      expect(await getPlatformTotalWalletBalance()).toBe(6950000);
      expect(await getTotalAdminLoadedMoney()).toBe(6950000);
      expect(await getPlatformTotalWalletBalance()).toBe(await getTotalAdminLoadedMoney());

      // Failed load: Shop B attempt that fails and rolls back
      await request(app)
        .post(`/api/admin/shops/${shopB.user.id}/load`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          amountDinars: 99999,
          _testFailureAfterBalanceUpdate: true,
        })
        .expect(500);

      // Invariant must STILL hold after rollback!
      expect(await getPlatformTotalWalletBalance()).toBe(6950000);
      expect(await getTotalAdminLoadedMoney()).toBe(6950000);
      expect(await getPlatformTotalWalletBalance()).toBe(await getTotalAdminLoadedMoney());
    });
  });
});
