import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { users, wallets, otpCodes } from '../src/db/schema.js';
import { getJwtSecret } from '../src/middleware/auth.js';

describe('Login & Token Authentication (Issue #8)', () => {
  const cleanDb = async () => {
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

  describe('POST /api/auth/login', () => {
    it('returns 200 with token and user info for valid verified credentials', async () => {
      const password = 'Password123!';
      const passwordHash = await bcrypt.hash(password, 10);
      const [user] = await db
        .insert(users)
        .values({
          phone: '0551234567',
          name: 'Verified User',
          passwordHash,
          role: 'customer',
          isVerified: true,
        })
        .returning();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: '0551234567', password });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user).toEqual({
        id: user.id,
        phone: '0551234567',
        name: 'Verified User',
        role: 'customer',
      });

      // Sensitive fields must be omitted
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.user).not.toHaveProperty('password');

      // Verify token decoded
      const decoded = jwt.verify(res.body.token, getJwtSecret());
      expect(decoded.id).toBe(user.id);
      expect(decoded.phone).toBe('0551234567');
      expect(decoded.role).toBe('customer');
      expect(decoded.exp).toBeDefined();
    });

    it('returns 400 when phone or password is missing or empty', async () => {
      const resMissingPass = await request(app)
        .post('/api/auth/login')
        .send({ phone: '0551234567' });
      expect(resMissingPass.status).toBe(400);
      expect(resMissingPass.body).toEqual({ error: 'Phone and password are required' });

      const resMissingPhone = await request(app)
        .post('/api/auth/login')
        .send({ password: 'Password123!' });
      expect(resMissingPhone.status).toBe(400);
      expect(resMissingPhone.body).toEqual({ error: 'Phone and password are required' });

      const resEmptyPhone = await request(app)
        .post('/api/auth/login')
        .send({ phone: '   ', password: 'Password123!' });
      expect(resEmptyPhone.status).toBe(400);
      expect(resEmptyPhone.body).toEqual({ error: 'Phone and password are required' });
    });

    it('returns 401 with generic message for non-existent phone number', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: '0559999999', password: 'AnyPassword123!' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid phone or password' });
    });

    it('returns 401 with identical generic message for incorrect password', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword123!', 10);
      await db.insert(users).values({
        phone: '0551112233',
        name: 'Existing User',
        passwordHash,
        role: 'customer',
        isVerified: true,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: '0551112233', password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid phone or password' });
    });

    it('returns 403 Forbidden when account is not verified', async () => {
      const password = 'Password123!';
      const passwordHash = await bcrypt.hash(password, 10);
      await db.insert(users).values({
        phone: '0554445566',
        name: 'Unverified User',
        passwordHash,
        role: 'customer',
        isVerified: false,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: '0554445566', password });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        error: 'Account is not verified. Please verify your phone number.',
      });
    });

    it('allows merchant and admin accounts to log in successfully', async () => {
      const password = 'Password123!';
      const passwordHash = await bcrypt.hash(password, 10);

      await db.insert(users).values({
        phone: '0557778899',
        name: 'Merchant Store',
        passwordHash,
        role: 'merchant',
        isVerified: true,
      });

      const resMerchant = await request(app)
        .post('/api/auth/login')
        .send({ phone: '0557778899', password });

      expect(resMerchant.status).toBe(200);
      expect(resMerchant.body.user.role).toBe('merchant');
      const merchantDecoded = jwt.verify(resMerchant.body.token, getJwtSecret());
      expect(merchantDecoded.role).toBe('merchant');

      await db.insert(users).values({
        phone: '0558889900',
        name: 'Admin Account',
        passwordHash,
        role: 'admin',
        isVerified: true,
      });

      const resAdmin = await request(app)
        .post('/api/auth/login')
        .send({ phone: '0558889900', password });

      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.user.role).toBe('admin');
      const adminDecoded = jwt.verify(resAdmin.body.token, getJwtSecret());
      expect(adminDecoded.role).toBe('admin');
    });
  });
});
