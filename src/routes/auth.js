import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, otpCodes, wallets } from '../db/schema.js';
import { createOtp, getLatestOtp } from '../services/otp.js';

const router = Router();

/**
 * POST /api/auth/register
 * Register a customer or merchant
 */
router.post('/register', async (req, res) => {
  try {
    const { phone, name, password, role = 'customer' } = req.body;

    if (!phone || !name || !password) {
      return res.status(400).json({ error: 'Phone, name, and password are required' });
    }

    if (role === 'admin') {
      return res.status(403).json({ error: 'Admin accounts cannot be self-registered' });
    }

    if (role !== 'customer' && role !== 'merchant') {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    const trimmedPhone = String(phone).trim();
    const trimmedName = String(name).trim();

    // Phone validation: Algerian phone number (e.g. 05/06/07 followed by 8 digits, or 9-10 digits)
    const phoneRegex = /^0\d{8,9}$/;
    if (!phoneRegex.test(trimmedPhone)) {
      return res.status(400).json({ error: 'Invalid phone format' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if phone already registered
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.phone, trimmedPhone))
      .limit(1);

    const existingUser = existingUsers[0];

    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(409).json({ error: 'Phone number already registered and verified' });
      }

      // Re-registering with an existing but unverified phone: update info and generate new OTP
      const passwordHash = await bcrypt.hash(password, 10);
      await db
        .update(users)
        .set({
          name: trimmedName,
          passwordHash,
          role,
        })
        .where(eq(users.id, existingUser.id));

      const otp = await createOtp(trimmedPhone);

      return res.status(200).json({
        message: 'Account already exists but unverified. A new verification OTP has been sent.',
        user: {
          id: existingUser.id,
          phone: trimmedPhone,
          name: trimmedName,
          role,
          isVerified: false,
        },
        otpSent: true,
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db
      .insert(users)
      .values({
        phone: trimmedPhone,
        name: trimmedName,
        passwordHash,
        role,
        isVerified: false,
      })
      .returning();

    await createOtp(trimmedPhone);

    return res.status(201).json({
      message: 'Registration successful. Please verify your phone with the OTP sent.',
      user: {
        id: newUser.id,
        phone: newUser.phone,
        name: newUser.name,
        role: newUser.role,
        isVerified: false,
      },
      otpSent: true,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/otp/:phone
 * Dev/test helper endpoint to retrieve the latest simulated OTP code (Rule R7)
 */
if (process.env.NODE_ENV !== 'production') {
  router.get('/otp/:phone', async (req, res) => {
    try {
      const latest = await getLatestOtp(req.params.phone);
      if (!latest) {
        return res.status(404).json({ error: 'No OTP found for this phone number' });
      }
      return res.status(200).json({
        phone: latest.phone,
        code: latest.code,
        expiresAt: latest.expiresAt,
        used: latest.used,
      });
    } catch (error) {
      console.error('OTP query error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
}

/**
 * POST /api/auth/verify-otp
 * Verify OTP code, mark user verified, and initialize wallet
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and OTP code are required' });
    }

    const trimmedPhone = String(phone).trim();
    const trimmedCode = String(code).trim();

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.phone, trimmedPhone))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'No user registered with this phone number' });
    }

    // Idempotency check: if user already verified
    if (user.isVerified) {
      return res.status(200).json({
        message: 'Account is already verified',
        user: {
          id: user.id,
          phone: user.phone,
          isVerified: true,
        },
      });
    }

    // Find latest OTP for this phone
    const latestOtp = await getLatestOtp(trimmedPhone);

    if (!latestOtp) {
      return res.status(400).json({ error: 'No OTP code found for this phone number' });
    }

    if (latestOtp.used) {
      return res.status(400).json({ error: 'OTP code has already been used' });
    }

    if (new Date() > new Date(latestOtp.expiresAt)) {
      return res.status(400).json({ error: 'OTP code has expired' });
    }

    if (latestOtp.code !== trimmedCode) {
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    // Mark OTP used, mark user verified, and initialize zero-balance wallet in a single transaction
    await db.transaction(async (tx) => {
      await tx
        .update(otpCodes)
        .set({ used: true })
        .where(eq(otpCodes.id, latestOtp.id));

      await tx
        .update(users)
        .set({ isVerified: true })
        .where(eq(users.id, user.id));

      const existingWallet = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, user.id))
        .limit(1);

      if (existingWallet.length === 0) {
        await tx.insert(wallets).values({
          userId: user.id,
          balance: 0,
        });
      }
    });

    return res.status(200).json({
      message: 'Account verified successfully',
      user: {
        id: user.id,
        phone: user.phone,
        isVerified: true,
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
