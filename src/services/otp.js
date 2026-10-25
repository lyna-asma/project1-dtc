import { db } from '../db/index.js';
import { otpCodes } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

/**
 * Pluggable OTP sending function (Rule R7)
 * Keep one-time code sending behind a single replaceable function
 * that logs/exposes codes for local review and automated tests without sending real SMS.
 */
export const sendOtp = async ({ phone, code }) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[OTP SIMULATOR] Phone: ${phone}, Code: ${code}`);
  }
  // Pluggable: integrate SMS provider here when required
  return true;
};

/**
 * Generate a random 6-digit numeric OTP code
 */
export const generateOtpCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Create a new OTP code in database and dispatch it
 */
export const createOtp = async (phone) => {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

  await db.insert(otpCodes).values({
    phone,
    code,
    expiresAt,
    used: false,
  });

  await sendOtp({ phone, code });

  return { code, expiresAt };
};

/**
 * Retrieve the latest OTP record for a phone number
 */
export const getLatestOtp = async (phone) => {
  const results = await db
    .select()
    .from(otpCodes)
    .where(eq(otpCodes.phone, phone))
    .orderBy(desc(otpCodes.createdAt), desc(otpCodes.id))
    .limit(1);

  return results[0] || null;
};
