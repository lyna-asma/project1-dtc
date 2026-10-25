import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { users, otpCodes, wallets } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

describe('User Registration & Simulated OTP Verification (Issue #7)', () => {
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

  describe('POST /api/auth/register', () => {
    it('creates an unverified customer account and dispatches OTP', async () => {
      const payload = {
        phone: '0550123456',
        name: 'Lyna Customer',
        password: 'secret123',
        role: 'customer',
      };

      const res = await request(app).post('/api/auth/register').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/successful/i);
      expect(res.body.user).toMatchObject({
        phone: '0550123456',
        name: 'Lyna Customer',
        role: 'customer',
        isVerified: false,
      });

      // Verify database record
      const [dbUser] = await db.select().from(users).where(eq(users.phone, '0550123456'));
      expect(dbUser).toBeDefined();
      expect(dbUser.isVerified).toBe(false);

      // Verify password hashing with bcryptjs (not stored in plain text)
      expect(dbUser.passwordHash).not.toBe('secret123');
      const isPasswordValid = await bcrypt.compare('secret123', dbUser.passwordHash);
      expect(isPasswordValid).toBe(true);

      // Verify OTP record created
      const [otp] = await db.select().from(otpCodes).where(eq(otpCodes.phone, '0550123456'));
      expect(otp).toBeDefined();
      expect(otp.code).toMatch(/^\d{6}$/);
      expect(otp.used).toBe(false);
    });

    it('creates an unverified merchant account', async () => {
      const payload = {
        phone: '0550987654',
        name: 'Superette El Bahia',
        password: 'secret123',
        role: 'merchant',
      };

      const res = await request(app).post('/api/auth/register').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('merchant');
      expect(res.body.user.name).toBe('Superette El Bahia');
    });

    it('rejects registration with role "admin"', async () => {
      const res = await request(app).post('/api/auth/register').send({
        phone: '0550111222',
        name: 'Admin Attempt',
        password: 'secret123',
        role: 'admin',
      });

      expect([400, 403]).toContain(res.status);
      expect(res.body.error).toMatch(/admin/i);
    });

    it('rejects registration when phone, name, or password is missing', async () => {
      const res1 = await request(app).post('/api/auth/register').send({
        name: 'No Phone',
        password: 'secret123',
      });
      expect(res1.status).toBe(400);

      const res2 = await request(app).post('/api/auth/register').send({
        phone: '0550123456',
        password: 'secret123',
      });
      expect(res2.status).toBe(400);

      const res3 = await request(app).post('/api/auth/register').send({
        phone: '0550123456',
        name: 'No Password',
      });
      expect(res3.status).toBe(400);
    });

    it('rejects invalid phone formats (non-numeric or invalid length)', async () => {
      const res1 = await request(app).post('/api/auth/register').send({
        phone: 'invalid-phone',
        name: 'Test User',
        password: 'secret123',
      });
      expect(res1.status).toBe(400);

      const res2 = await request(app).post('/api/auth/register').send({
        phone: '123',
        name: 'Test User',
        password: 'secret123',
      });
      expect(res2.status).toBe(400);
    });

    it('rejects passwords shorter than 6 characters', async () => {
      const res = await request(app).post('/api/auth/register').send({
        phone: '0550123456',
        name: 'Short Password',
        password: '123',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/6 characters/i);
    });

    it('rejects duplicate registration for an already verified phone number with 409 Conflict', async () => {
      const phone = '0550555555';
      const passwordHash = await bcrypt.hash('secret123', 10);
      await db.insert(users).values({
        phone,
        name: 'Already Verified',
        passwordHash,
        role: 'customer',
        isVerified: true,
      });

      const res = await request(app).post('/api/auth/register').send({
        phone,
        name: 'Duplicate Attempt',
        password: 'secret123',
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already registered/i);
    });

    it('allows re-registering an unverified phone number by generating a new OTP', async () => {
      const phone = '0550666666';

      // First attempt
      const res1 = await request(app).post('/api/auth/register').send({
        phone,
        name: 'First Attempt',
        password: 'secret123',
      });
      expect(res1.status).toBe(201);

      // Re-registering before verification
      const res2 = await request(app).post('/api/auth/register').send({
        phone,
        name: 'Second Updated Attempt',
        password: 'newsecret123',
      });

      expect([200, 201]).toContain(res2.status);

      // Check user updated
      const [updatedUser] = await db.select().from(users).where(eq(users.phone, phone));
      expect(updatedUser.name).toBe('Second Updated Attempt');
      expect(updatedUser.isVerified).toBe(false);

      // Multiple OTPs generated
      const otps = await db.select().from(otpCodes).where(eq(otpCodes.phone, phone));
      expect(otps.length).toBe(2);
    });
  });

  describe('Simulated OTP inspection endpoint GET /api/auth/otp/:phone', () => {
    it('returns the latest generated OTP for dev/test verification', async () => {
      const phone = '0550777777';
      await request(app).post('/api/auth/register').send({
        phone,
        name: 'OTP Inspector User',
        password: 'secret123',
      });

      const res = await request(app).get(`/api/auth/otp/${phone}`);
      expect(res.status).toBe(200);
      expect(res.body.phone).toBe(phone);
      expect(res.body.code).toMatch(/^\d{6}$/);
      expect(res.body.used).toBe(false);
    });

    it('returns 404 if no OTP was found for phone', async () => {
      const res = await request(app).get('/api/auth/otp/0550000000');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    it('verifies account with valid OTP, marks code used, and creates wallet with balance = 0', async () => {
      const phone = '0550888888';
      await request(app).post('/api/auth/register').send({
        phone,
        name: 'Verification Success User',
        password: 'secret123',
      });

      const otpRes = await request(app).get(`/api/auth/otp/${phone}`);
      const code = otpRes.body.code;

      const verifyRes = await request(app).post('/api/auth/verify-otp').send({
        phone,
        code,
      });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.user.isVerified).toBe(true);

      // Verify user table in DB
      const [user] = await db.select().from(users).where(eq(users.phone, phone));
      expect(user.isVerified).toBe(true);

      // Verify OTP marked used
      const [otp] = await db.select().from(otpCodes).where(eq(otpCodes.phone, phone));
      expect(otp.used).toBe(true);

      // Verify wallet initialized with balance = 0
      const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, user.id));
      expect(wallet).toBeDefined();
      expect(Number(wallet.balance)).toBe(0);
    });

    it('rejects incorrect 6-digit OTP and leaves user unverified', async () => {
      const phone = '0550999999';
      await request(app).post('/api/auth/register').send({
        phone,
        name: 'Wrong OTP User',
        password: 'secret123',
      });

      const verifyRes = await request(app).post('/api/auth/verify-otp').send({
        phone,
        code: '000000',
      });

      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.error).toMatch(/invalid/i);

      const [user] = await db.select().from(users).where(eq(users.phone, phone));
      expect(user.isVerified).toBe(false);

      const walletsList = await db.select().from(wallets).where(eq(wallets.userId, user.id));
      expect(walletsList.length).toBe(0);
    });

    it('rejects already used OTP', async () => {
      const phone = '0550112233';
      await request(app).post('/api/auth/register').send({
        phone,
        name: 'Used OTP User',
        password: 'secret123',
      });

      const otpRes = await request(app).get(`/api/auth/otp/${phone}`);
      const code = otpRes.body.code;

      // First verification succeeds
      await request(app).post('/api/auth/verify-otp').send({ phone, code });

      // Unverify user manually to test reusing used OTP
      await db.update(users).set({ isVerified: false }).where(eq(users.phone, phone));

      // Attempt verification with already used code
      const verifyRes = await request(app).post('/api/auth/verify-otp').send({ phone, code });
      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.error).toMatch(/already been used/i);
    });

    it('rejects expired OTP', async () => {
      const phone = '0550223344';
      await request(app).post('/api/auth/register').send({
        phone,
        name: 'Expired OTP User',
        password: 'secret123',
      });

      // Manually set OTP expiration to past
      await db
        .update(otpCodes)
        .set({ expiresAt: new Date(Date.now() - 60 * 1000) })
        .where(eq(otpCodes.phone, phone));

      const otpRes = await request(app).get(`/api/auth/otp/${phone}`);
      const code = otpRes.body.code;

      const verifyRes = await request(app).post('/api/auth/verify-otp').send({ phone, code });
      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.error).toMatch(/expired/i);
    });

    it('returns 404 when verifying a non-existent phone number', async () => {
      const res = await request(app).post('/api/auth/verify-otp').send({
        phone: '0550000000',
        code: '123456',
      });
      expect(res.status).toBe(404);
    });

    it('is idempotent: verifying an already verified account returns 200 without creating duplicate wallets', async () => {
      const phone = '0550334455';
      await request(app).post('/api/auth/register').send({
        phone,
        name: 'Idempotency User',
        password: 'secret123',
      });

      const otpRes = await request(app).get(`/api/auth/otp/${phone}`);
      const code = otpRes.body.code;

      // 1st verify
      const res1 = await request(app).post('/api/auth/verify-otp').send({ phone, code });
      expect(res1.status).toBe(200);

      // 2nd verify
      const res2 = await request(app).post('/api/auth/verify-otp').send({ phone, code });
      expect(res2.status).toBe(200);

      const [user] = await db.select().from(users).where(eq(users.phone, phone));
      const walletsList = await db.select().from(wallets).where(eq(wallets.userId, user.id));
      expect(walletsList.length).toBe(1);
    });
  });
});
