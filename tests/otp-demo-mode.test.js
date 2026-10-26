import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { users, wallets, transactions, otpCodes, paymentRequests, idempotencyKeys } from '../src/db/schema.js';
import { isOtpExposed } from '../src/services/otp.js';

describe('Simulated OTP visibility: DEMO_MODE vs production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDemoMode = process.env.DEMO_MODE;

  const cleanDb = async () => {
    await db.delete(idempotencyKeys);
    await db.delete(paymentRequests);
    await db.delete(transactions);
    await db.delete(wallets);
    await db.delete(otpCodes);
    await db.delete(users);
  };

  const restoreEnv = () => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = originalDemoMode;
  };

  beforeAll(cleanDb);
  beforeEach(cleanDb);
  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    restoreEnv();
    await cleanDb();
    await pool.end();
  });

  const register = (phone) =>
    request(app).post('/api/auth/register').send({
      phone,
      name: 'Demo User',
      password: 'secret123',
      role: 'customer',
    });

  it('isOtpExposed is false in production when DEMO_MODE is unset or not "true"', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DEMO_MODE;
    expect(isOtpExposed()).toBe(false);
    process.env.DEMO_MODE = 'false';
    expect(isOtpExposed()).toBe(false);
  });

  it('isOtpExposed is true in production when DEMO_MODE=true, and outside production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = 'true';
    expect(isOtpExposed()).toBe(true);
    process.env.NODE_ENV = 'test';
    delete process.env.DEMO_MODE;
    expect(isOtpExposed()).toBe(true);
  });

  it('production without DEMO_MODE: code is not logged and GET /api/auth/otp/:phone returns 404', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DEMO_MODE;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const res = await register('0550444401');
    expect(res.status).toBe(201);

    expect(logSpy.mock.calls.some((c) => String(c[0]).includes('[OTP SIMULATOR]'))).toBe(false);
    const otpRes = await request(app).get('/api/auth/otp/0550444401');
    expect(otpRes.status).toBe(404);
  });

  it('production with DEMO_MODE=true: code is logged, readable via the endpoint, and sign-up completes', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = 'true';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const res = await register('0550444402');
    expect(res.status).toBe(201);

    const otpRes = await request(app).get('/api/auth/otp/0550444402');
    expect(otpRes.status).toBe(200);
    expect(otpRes.body.code).toMatch(/^\d{6}$/);

    expect(
      logSpy.mock.calls.some(
        (c) => String(c[0]).includes('[OTP SIMULATOR]') && String(c[0]).includes(otpRes.body.code)
      )
    ).toBe(true);

    const verify = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '0550444402', code: otpRes.body.code });
    expect(verify.status).toBe(200);
  });
});

