import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app as mainApp } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import {
  users,
  wallets,
  transactions,
  otpCodes,
  paymentRequests,
  idempotencyKeys,
} from '../src/db/schema.js';
import { DEFAULT_JWT_SECRET, getJwtSecret, requireAuth } from '../src/middleware/auth.js';
import { startServer } from '../src/index.js';
import { seedAdmin } from '../src/scripts/seed-admin.js';

describe('Task 18: Fail-Fast Production Secrets & Admin Seed Hardening', () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
    ADMIN_PHONE: process.env.ADMIN_PHONE,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_NAME: process.env.ADMIN_NAME,
  };

  const restoreEnv = () => {
    for (const [key, val] of Object.entries(originalEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  };

  const cleanDb = async () => {
    await db.delete(idempotencyKeys);
    await db.delete(paymentRequests);
    await db.delete(transactions);
    await db.delete(wallets);
    await db.delete(otpCodes);
    await db.delete(users);
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

  describe('getJwtSecret() production fail-fast & dev fallback', () => {
    it('throws in NODE_ENV=production when JWT_SECRET is unset, blank, whitespace, or placeholder', () => {
      process.env.NODE_ENV = 'production';

      const invalidSecrets = [
        undefined,
        '',
        '   ',
        DEFAULT_JWT_SECRET,
        'dev-secret-key-change-in-production',
        'docker-jwt-secret-key-change-in-production',
      ];

      for (const secret of invalidSecrets) {
        if (secret === undefined) {
          delete process.env.JWT_SECRET;
        } else {
          process.env.JWT_SECRET = secret;
        }

        expect(() => getJwtSecret()).toThrow(
          'JWT_SECRET must be explicitly configured in production'
        );
      }
    });

    it('returns explicit custom JWT_SECRET in NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'super-strong-prod-secret-value-2026';

      expect(getJwtSecret()).toBe('super-strong-prod-secret-value-2026');
    });

    it('falls back to DEFAULT_JWT_SECRET outside production when unset or empty', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.JWT_SECRET;
      expect(getJwtSecret()).toBe(DEFAULT_JWT_SECRET);

      process.env.JWT_SECRET = '   ';
      expect(getJwtSecret()).toBe(DEFAULT_JWT_SECRET);

      process.env.JWT_SECRET = 'custom-local-test-secret';
      expect(getJwtSecret()).toBe('custom-local-test-secret');
    });
  });

  describe('requireAuth & startServer production secret enforcement', () => {
    it('requireAuth propagates missing-secret error in production instead of catching into 401', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      const mockReq = {
        headers: {
          authorization: 'Bearer some.jwt.token',
        },
      };
      const statusFn = vi.fn();
      const jsonFn = vi.fn();
      const mockRes = {
        status: statusFn.mockReturnValue({ json: jsonFn }),
      };
      const nextFn = vi.fn();

      expect(() => requireAuth(mockReq, mockRes, nextFn)).toThrow(
        'JWT_SECRET must be explicitly configured in production'
      );
      expect(statusFn).not.toHaveBeenCalled();
      expect(nextFn).not.toHaveBeenCalled();

      // Verify Express HTTP route does NOT swallow missing secret into 401 Invalid authentication token
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const isolatedApp = express();
      isolatedApp.get('/protected', requireAuth, (_req, res) => res.status(200).json({ ok: true }));
      isolatedApp.use((err, _req, res, _next) => {
        res.status(500).json({ error: err.message });
      });

      const isolatedRes = await request(isolatedApp)
        .get('/protected')
        .set('Authorization', 'Bearer some.jwt.token');

      expect(isolatedRes.status).toBe(500);
      expect(isolatedRes.status).not.toBe(401);
      expect(isolatedRes.body.error).toBe('JWT_SECRET must be explicitly configured in production');

      const mainRes = await request(mainApp)
        .get('/api/customer/balance')
        .set('Authorization', 'Bearer some.jwt.token');

      expect(mainRes.status).toBe(500);
      expect(mainRes.status).not.toBe(401);
      errSpy.mockRestore();
    });

    it('startServer() rejects before binding a port when NODE_ENV=production and JWT_SECRET is invalid', async () => {
      process.env.NODE_ENV = 'production';
      const listenSpy = vi.spyOn(mainApp, 'listen');

      delete process.env.JWT_SECRET;
      await expect(startServer()).rejects.toThrow(
        'JWT_SECRET must be explicitly configured in production'
      );

      process.env.JWT_SECRET = 'docker-jwt-secret-key-change-in-production';
      await expect(startServer()).rejects.toThrow(
        'JWT_SECRET must be explicitly configured in production'
      );

      expect(listenSpy).not.toHaveBeenCalled();
    });
  });

  describe('seedAdmin() environment & explicit credential hardening', () => {
    it('rejects missing, empty, and whitespace phone or password without creating DB rows', async () => {
      delete process.env.ADMIN_PHONE;
      delete process.env.ADMIN_PASSWORD;

      await expect(seedAdmin()).rejects.toThrow(
        'ADMIN_PHONE and ADMIN_PASSWORD must be explicitly provided to seed an admin account'
      );

      const invalidCases = [
        { phone: '', password: 'ValidPassword123!' },
        { phone: '   ', password: 'ValidPassword123!' },
        { phone: '0555990002', password: '' },
        { phone: '0555990002', password: '   ' },
      ];

      for (const testCase of invalidCases) {
        await expect(seedAdmin(testCase)).rejects.toThrow(
          'ADMIN_PHONE and ADMIN_PASSWORD must be explicitly provided to seed an admin account'
        );
      }

      process.env.ADMIN_PHONE = '   ';
      process.env.ADMIN_PASSWORD = 'ValidPassword123!';
      await expect(seedAdmin()).rejects.toThrow(
        'ADMIN_PHONE and ADMIN_PASSWORD must be explicitly provided to seed an admin account'
      );

      expect(await db.select().from(users)).toHaveLength(0);
      expect(await db.select().from(wallets)).toHaveLength(0);
    });

    it('seeds admin idempotently via process.env and preserves intentional password characters', async () => {
      process.env.ADMIN_PHONE = '  0555990003  ';
      process.env.ADMIN_PASSWORD = ' EnvAdminSecret! ';
      delete process.env.ADMIN_NAME;

      const first = await seedAdmin();
      expect(first.phone).toBe('0555990003');
      expect(first.name).toBe('Platform Admin');
      expect(first.role).toBe('admin');
      expect(first.isVerified).toBe(true);
      expect(await bcrypt.compare(' EnvAdminSecret! ', first.passwordHash)).toBe(true);

      const second = await seedAdmin();
      expect(second.id).toBe(first.id);
      expect(await db.select().from(users)).toHaveLength(1);
      expect(await db.select().from(wallets)).toHaveLength(1);
    });
  });
});
