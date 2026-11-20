import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, wallets, transactions, paymentRequests, idempotencyKeys } from '../db/schema.js';
import { extractRawAmountInput, parseWholeDinars } from './validation.js';
import { ensureWalletInTx } from './wallet.js';

/**
 * Generate a random 6-character uppercase alphanumeric code
 */
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Generate a new single-use 5-minute payment request code for a merchant
 */
export async function createPaymentRequest({
  merchantId,
  amountDinars,
  amount,
  body,
}, dbClient = db) {
  const { hasValue, rawAmount } = extractRawAmountInput({
    amountDinars,
    amount,
    body,
  });

  const validatedAmountDinars = parseWholeDinars(rawAmount, {
    hasValue,
    fieldLabel: 'amountDinars',
  });

  // Verify merchant user exists and has merchant role
  const [merchant] = await dbClient
    .select()
    .from(users)
    .where(eq(users.id, merchantId))
    .limit(1);

  if (!merchant || merchant.role !== 'merchant') {
    const err = new Error('Merchant not found');
    err.statusCode = 404;
    throw err;
  }

  // Generate a unique 6-character code
  let code;
  let attempts = 0;
  while (attempts < 10) {
    code = generateCode();
    const [existing] = await dbClient
      .select({ id: paymentRequests.id })
      .from(paymentRequests)
      .where(eq(paymentRequests.code, code))
      .limit(1);
    if (!existing) break;
    attempts++;
  }

  if (!code) {
    const err = new Error('Failed to generate unique payment code');
    err.statusCode = 500;
    throw err;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // exactly 5 minutes
  const amountCentimes = validatedAmountDinars * 100;

  const [request] = await dbClient
    .insert(paymentRequests)
    .values({
      code,
      merchantId,
      amount: amountCentimes,
      status: 'pending',
      expiresAt,
    })
    .returning();

  return {
    code: request.code,
    amountDinars: validatedAmountDinars,
    amountCentimes,
    expiresAt:
      request.expiresAt instanceof Date
        ? request.expiresAt.toISOString()
        : new Date(request.expiresAt).toISOString(),
    status: request.status,
  };
}

/**
 * Inspect a payment request by code
 */
export async function inspectPaymentRequest(code, dbClient = db) {
  if (!code || typeof code !== 'string' || code.trim() === '') {
    const err = new Error('Payment request not found');
    err.statusCode = 404;
    throw err;
  }

  const trimmedCode = code.trim();

  const [record] = await dbClient
    .select({
      id: paymentRequests.id,
      code: paymentRequests.code,
      merchantId: paymentRequests.merchantId,
      amount: paymentRequests.amount,
      status: paymentRequests.status,
      expiresAt: paymentRequests.expiresAt,
      createdAt: paymentRequests.createdAt,
      shopName: users.name,
      shopPhone: users.phone,
    })
    .from(paymentRequests)
    .innerJoin(users, eq(paymentRequests.merchantId, users.id))
    .where(eq(paymentRequests.code, trimmedCode))
    .limit(1);

  if (!record) {
    const err = new Error('Payment request not found');
    err.statusCode = 404;
    throw err;
  }

  if (record.status === 'completed') {
    const err = new Error('Payment code already used');
    err.statusCode = 400;
    throw err;
  }

  const isExpired =
    record.status === 'expired' || new Date() > new Date(record.expiresAt);

  if (isExpired) {
    if (record.status === 'pending') {
      await dbClient
        .update(paymentRequests)
        .set({ status: 'expired' })
        .where(eq(paymentRequests.id, record.id));
    }
    const err = new Error('Payment code has expired');
    err.statusCode = 400;
    throw err;
  }

  const amountCentimes = Number(record.amount);
  const amountDinars = Math.floor(amountCentimes / 100);

  return {
    code: record.code,
    shopName: record.shopName,
    shopPhone: record.shopPhone,
    amountDinars,
    amountCentimes,
    expiresAt:
      record.expiresAt instanceof Date
        ? record.expiresAt.toISOString()
        : new Date(record.expiresAt).toISOString(),
    status: 'pending',
  };
}

/**
 * Confirm a payment request using customer password
 */
export async function confirmPaymentRequest({
  code,
  customerUserId,
  password,
  idempotencyKey = null,
  endpoint = 'POST /api/customer/payment-requests/:code/confirm',
  _testFailureAfterBalanceUpdate = false,
}, dbClient = db) {
  // 1. Validate password input before any DB replay
  if (
    password === undefined ||
    password === null ||
    typeof password !== 'string' ||
    password.trim() === ''
  ) {
    const err = new Error('Password is required');
    err.statusCode = 400;
    throw err;
  }

  // 2. Fetch customer user
  const [customerUser] = await dbClient
    .select()
    .from(users)
    .where(eq(users.id, customerUserId))
    .limit(1);

  if (!customerUser) {
    const err = new Error('Customer not found');
    err.statusCode = 404;
    throw err;
  }

  // 3. Password verification strictly BEFORE idempotency check/replay
  const isPasswordValid = await bcrypt.compare(password, customerUser.passwordHash);
  if (!isPasswordValid) {
    const err = new Error('Invalid password');
    err.statusCode = 401;
    throw err;
  }

  // 4. Validate payment code
  if (!code || typeof code !== 'string' || code.trim() === '') {
    const err = new Error('Payment request not found');
    err.statusCode = 404;
    throw err;
  }
  const trimmedCode = code.trim();

  // 5. Normalize and validate idempotency key and endpoint scope
  let trimmedKey = null;
  if (idempotencyKey !== null && idempotencyKey !== undefined) {
    if (typeof idempotencyKey !== 'string') {
      const err = new Error('Invalid idempotency key');
      err.statusCode = 400;
      throw err;
    }
    const candidateKey = idempotencyKey.trim();
    if (candidateKey.length > 255) {
      const err = new Error('Invalid idempotency key');
      err.statusCode = 400;
      throw err;
    }
    if (candidateKey !== '') {
      trimmedKey = candidateKey;
    }
  }

  const normalizedEndpoint =
    typeof endpoint === 'string' && endpoint.trim() !== ''
      ? endpoint.trim()
      : 'POST /api/customer/payment-requests/:code/confirm';

  // 6. Compute request hash excluding password & test failure hook
  const requestHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ code: trimmedCode }))
    .digest('hex');

  // 7. Atomic transaction with in-transaction advisory lock & scoped idempotency
  let expiredRequestId = null;

  try {
    return await dbClient.transaction(async (tx) => {
      if (trimmedKey) {
        const lockScope = `${normalizedEndpoint}:${trimmedKey}`;
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(CAST(${customerUserId} AS integer), hashtext(CAST(${lockScope} AS text)))`
        );

        const [existingKey] = await tx
          .select()
          .from(idempotencyKeys)
          .where(
            and(
              eq(idempotencyKeys.userId, customerUserId),
              eq(idempotencyKeys.endpoint, normalizedEndpoint),
              eq(idempotencyKeys.key, trimmedKey)
            )
          )
          .limit(1);

        if (existingKey) {
          if (existingKey.requestHash !== requestHash) {
            const err = new Error(
              'Idempotency key already used with different request parameters'
            );
            err.statusCode = 409;
            throw err;
          }
          return JSON.parse(existingKey.responseBody);
        }
      }

      // Lock payment request row by code
      const [lockedRequest] = await tx
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.code, trimmedCode))
        .for('update');

      if (!lockedRequest) {
        const err = new Error('Payment request not found');
        err.statusCode = 404;
        throw err;
      }

      if (lockedRequest.status === 'completed') {
        const err = new Error('Payment code already used');
        err.statusCode = 400;
        throw err;
      }

      if (
        lockedRequest.status === 'expired' ||
        new Date() > new Date(lockedRequest.expiresAt)
      ) {
        if (lockedRequest.status === 'pending') {
          expiredRequestId = lockedRequest.id;
        }
        const err = new Error('Payment code has expired');
        err.statusCode = 400;
        throw err;
      }

      // Self-payment check
      if (lockedRequest.merchantId === customerUserId) {
        const err = new Error('Cannot pay yourself');
        err.statusCode = 400;
        throw err;
      }

      // Fetch merchant user
      const [merchantUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, lockedRequest.merchantId))
        .limit(1);

      if (!merchantUser) {
        const err = new Error('Merchant not found');
        err.statusCode = 404;
        throw err;
      }

      // Safely ensure customer & merchant wallets exist (initial balance 0)
      const customerWallet = await ensureWalletInTx(tx, customerUserId);
      const merchantWallet = await ensureWalletInTx(tx, merchantUser.id);

      // Deterministic row-level locking: lower wallet ID first
      const walletIdsInOrder = [customerWallet.id, merchantWallet.id].sort((a, b) => a - b);
      const lockedWalletsMap = new Map();
      for (const wid of walletIdsInOrder) {
        const [locked] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.id, wid))
          .for('update');
        lockedWalletsMap.set(wid, locked);
      }

      const lockedCustomerWallet = lockedWalletsMap.get(customerWallet.id);

      // Check customer balance
      const currentCustomerBalance = Number(lockedCustomerWallet.balance);
      const paymentAmountCentimes = Number(lockedRequest.amount);

      if (currentCustomerBalance < paymentAmountCentimes) {
        const err = new Error('Insufficient customer balance');
        err.statusCode = 400;
        throw err;
      }

      // Balance updates
      const [updatedCustomerWallet] = await tx
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} - ${paymentAmountCentimes}`,
        })
        .where(eq(wallets.id, customerWallet.id))
        .returning();

      await tx
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} + ${paymentAmountCentimes}`,
        })
        .where(eq(wallets.id, merchantWallet.id))
        .returning();

      // Hook for rollback testing (locked off in production)
      if (process.env.NODE_ENV !== 'production' && _testFailureAfterBalanceUpdate) {
        throw new Error('Simulated failure during payment confirmation');
      }

      // Update payment request status to completed
      await tx
        .update(paymentRequests)
        .set({ status: 'completed' })
        .where(eq(paymentRequests.id, lockedRequest.id));

      // Immutable ledger entry in transactions
      const [createdTx] = await tx
        .insert(transactions)
        .values({
          type: 'payment',
          fromWalletId: customerWallet.id,
          toWalletId: merchantWallet.id,
          amount: paymentAmountCentimes,
          feeAmount: 0,
          status: 'completed',
          referenceId: lockedRequest.id,
          description: `Payment to ${merchantUser.name}`,
        })
        .returning();

      const newCustomerBalanceCentimes = Number(updatedCustomerWallet.balance);
      const newCustomerBalanceDinars = Math.floor(newCustomerBalanceCentimes / 100);
      const paymentAmountDinars = Math.floor(paymentAmountCentimes / 100);

      const result = {
        message: 'Payment confirmed successfully',
        code: lockedRequest.code,
        amountDinars: paymentAmountDinars,
        amountCentimes: paymentAmountCentimes,
        shopName: merchantUser.name,
        newCustomerBalanceDinars,
        newCustomerBalanceCentimes,
        transaction: {
          id: createdTx.id,
          type: 'payment',
          amountDinars: paymentAmountDinars,
          amountCentimes: paymentAmountCentimes,
          fromWalletId: createdTx.fromWalletId,
          toWalletId: createdTx.toWalletId,
          status: 'completed',
          createdAt:
            createdTx.createdAt instanceof Date
              ? createdTx.createdAt.toISOString()
              : new Date(createdTx.createdAt).toISOString(),
        },
      };

      if (trimmedKey) {
        await tx.insert(idempotencyKeys).values({
          key: trimmedKey,
          userId: customerUserId,
          endpoint: normalizedEndpoint,
          requestHash,
          statusCode: 200,
          responseBody: JSON.stringify(result),
        });
      }

      return result;
    });
  } catch (err) {
    if (expiredRequestId !== null) {
      await dbClient
        .update(paymentRequests)
        .set({ status: 'expired' })
        .where(
          and(
            eq(paymentRequests.id, expiredRequestId),
            eq(paymentRequests.status, 'pending')
          )
        );
    }
    throw err;
  }
}
