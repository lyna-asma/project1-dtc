import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app as mainApp } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { users, wallets, otpCodes } from '../src/db/schema.js';
import {
  requireAuth,
  requireRole,
  requireSelfOrAdmin,
  generateToken,
  getJwtSecret,
} from '../src/middleware/auth.js';
import { seedAdmin } from '../src/scripts/seed-admin.js';

describe('Role-Based Access Control, Middleware & Admin Seed (Issue #8)', () => {
  let testApp;

  const cleanDb = async () => {
    await db.delete(wallets);
    await db.delete(otpCodes);
    await db.delete(users);
  };

  beforeAll(async () => {
    await cleanDb();

    // Create a lightweight Express test app mounting the middleware routes
    testApp = express();
    testApp.use(express.json());

    // Protected route returning req.user
    testApp.get('/test/protected', requireAuth, (req, res) => {
      res.status(200).json({ user: req.user });
    });

    // Admin only route
    testApp.get('/test/admin-only', requireAuth, requireRole('admin'), (req, res) => {
      res.status(200).json({ message: 'Welcome Admin' });
    });

    // Merchant only route
    testApp.get('/test/merchant-only', requireAuth, requireRole('merchant'), (req, res) => {
      res.status(200).json({ message: 'Welcome Merchant' });
    });

    // Merchant or Admin route
    testApp.get('/test/merchant-or-admin', requireAuth, requireRole('merchant', 'admin'), (req, res) => {
      res.status(200).json({ message: 'Welcome Merchant or Admin' });
    });

    // Resource isolation route
    testApp.get('/test/users/:userId/data', requireAuth, requireSelfOrAdmin, (req, res) => {
      res.status(200).json({ message: `Access granted for resource ${req.params.userId}` });
    });
  });

  beforeEach(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
    await pool.end();
  });

  describe('Authentication middleware (requireAuth)', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(testApp).get('/test/protected');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Authentication token required' });
    });

    it('returns 401 when Authorization header is malformed (missing Bearer prefix or token)', async () => {
      const resNoBearer = await request(testApp)
        .get('/test/protected')
        .set('Authorization', 'InvalidToken12345');
      expect(resNoBearer.status).toBe(401);
      expect(resNoBearer.body).toEqual({ error: 'Invalid authorization header format' });

      const resEmptyBearer = await request(testApp)
        .get('/test/protected')
        .set('Authorization', 'Bearer ');
      expect(resEmptyBearer.status).toBe(401);
      expect(resEmptyBearer.body).toEqual({ error: 'Invalid authorization header format' });

      const resExtraParts = await request(testApp)
        .get('/test/protected')
        .set('Authorization', 'Bearer token extra');
      expect(resExtraParts.status).toBe(401);
      expect(resExtraParts.body).toEqual({ error: 'Invalid authorization header format' });
    });

    it('returns 401 when JWT token is invalid or tampered with', async () => {
      const validToken = generateToken({ id: 1, phone: '0551111111', role: 'customer' });
      const tamperedToken = validToken.slice(0, -5) + 'abcde';

      const res = await request(testApp)
        .get('/test/protected')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid authentication token' });
    });

    it('returns 401 when JWT token is expired', async () => {
      // Generate token expired 10 seconds ago
      const expiredToken = jwt.sign(
        { id: 1, phone: '0551111111', role: 'customer' },
        getJwtSecret(),
        { expiresIn: '-10s' }
      );

      const res = await request(testApp)
        .get('/test/protected')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Token has expired' });
    });

    it('attaches decoded user payload to req.user and proceeds with valid token', async () => {
      const token = generateToken({
        id: 99,
        phone: '0551112233',
        name: 'Test Customer',
        role: 'customer',
      });

      const res = await request(testApp)
        .get('/test/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        id: 99,
        phone: '0551112233',
        name: 'Test Customer',
        role: 'customer',
      });
    });
  });

  describe('Role-based authorization middleware (requireRole)', () => {
    const customerToken = generateToken({ id: 1, phone: '0551000001', role: 'customer' });
    const merchantToken = generateToken({ id: 2, phone: '0551000002', role: 'merchant' });
    const adminToken = generateToken({ id: 3, phone: '0551000003', role: 'admin' });

    it('denies customer and merchant from accessing admin-guarded route', async () => {
      const resCustomer = await request(testApp)
        .get('/test/admin-only')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(resCustomer.status).toBe(403);
      expect(resCustomer.body).toEqual({ error: 'Insufficient permissions' });

      const resMerchant = await request(testApp)
        .get('/test/admin-only')
        .set('Authorization', `Bearer ${merchantToken}`);
      expect(resMerchant.status).toBe(403);
      expect(resMerchant.body).toEqual({ error: 'Insufficient permissions' });
    });

    it('allows admin to access admin-guarded route', async () => {
      const res = await request(testApp)
        .get('/test/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Welcome Admin');
    });

    it('denies customer from accessing merchant-guarded route', async () => {
      const res = await request(testApp)
        .get('/test/merchant-only')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Insufficient permissions' });
    });

    it('allows merchant to access merchant-guarded route', async () => {
      const res = await request(testApp)
        .get('/test/merchant-only')
        .set('Authorization', `Bearer ${merchantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Welcome Merchant');
    });

    it('supports multi-role routes (e.g. merchant and admin)', async () => {
      const resCustomer = await request(testApp)
        .get('/test/merchant-or-admin')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(resCustomer.status).toBe(403);
      expect(resCustomer.body).toEqual({ error: 'Insufficient permissions' });

      const resMerchant = await request(testApp)
        .get('/test/merchant-or-admin')
        .set('Authorization', `Bearer ${merchantToken}`);
      expect(resMerchant.status).toBe(200);

      const resAdmin = await request(testApp)
        .get('/test/merchant-or-admin')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
    });
  });

  describe('Resource isolation middleware (requireSelfOrAdmin)', () => {
    const user1Token = generateToken({ id: 10, phone: '0551000010', role: 'customer' });
    const user2Token = generateToken({ id: 20, phone: '0551000020', role: 'customer' });
    const adminToken = generateToken({ id: 99, phone: '0551000099', role: 'admin' });

    it('denies a customer trying to access another customer resource', async () => {
      const res = await request(testApp)
        .get('/test/users/20/data')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        error: 'Access denied: You can only access your own resources',
      });
    });

    it('allows a customer to access their own resource', async () => {
      const res = await request(testApp)
        .get('/test/users/10/data')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Access granted for resource 10');
    });

    it('allows admin to access any customer resource', async () => {
      const res = await request(testApp)
        .get('/test/users/10/data')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Access granted for resource 10');
    });
  });

  describe('Admin seed script (seedAdmin)', () => {
    it('creates an admin account with verified status and zero balance wallet', async () => {
      const admin = await seedAdmin({
        phone: '0555000000',
        password: 'Admin1234!',
        name: 'Platform Admin',
      });

      expect(admin).toBeDefined();
      expect(admin.phone).toBe('0555000000');
      expect(admin.role).toBe('admin');
      expect(admin.isVerified).toBe(true);

      // Verify password hashed
      const isPasswordValid = await bcrypt.compare('Admin1234!', admin.passwordHash);
      expect(isPasswordValid).toBe(true);

      // Verify wallet initialized with balance 0
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(wallets.userId.getSQL() ? undefined : null, undefined);
      const [adminWallet] = await db.select().from(wallets);
      expect(adminWallet).toBeDefined();
      expect(adminWallet.balance).toBe(0);

      // Verify admin can immediately log in via POST /api/auth/login
      const loginRes = await request(mainApp)
        .post('/api/auth/login')
        .send({ phone: '0555000000', password: 'Admin1234!' });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.role).toBe('admin');
      expect(loginRes.body).toHaveProperty('token');
    });

    it('is idempotent: running seed repeatedly does not fail or duplicate entries', async () => {
      const firstRun = await seedAdmin({
        phone: '0555000000',
        password: 'Admin1234!',
        name: 'Platform Admin',
      });

      const secondRun = await seedAdmin({
        phone: '0555000000',
        password: 'Admin1234!',
        name: 'Platform Admin',
      });

      expect(secondRun.id).toBe(firstRun.id);

      const allUsers = await db.select().from(users);
      expect(allUsers.length).toBe(1);

      const allWallets = await db.select().from(wallets);
      expect(allWallets.length).toBe(1);
    });
  });
});
