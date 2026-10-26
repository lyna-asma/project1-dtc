import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, wallets, transactions, paymentRequests } from '../db/schema.js';

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
  const payload = body || {};

  const hasAmountDinars =
    amountDinars !== undefined ||
    (Object.prototype.hasOwnProperty.call(payload, 'amountDinars') && payload.amountDinars !== undefined);

  const hasAmount =
    amount !== undefined ||
    (Object.prototype.hasOwnProperty.call(payload, 'amount') && payload.amount !== undefined);

  if (!hasAmountDinars && !hasAmount) {
    const err = new Error('amountDinars must be a positive integer');
    err.statusCode = 400;
    throw err;
  }

  const rawAmount = hasAmountDinars
    ? amountDinars !== undefined
      ? amountDinars
      : payload.amountDinars
    : amount !== undefined
      ? amount
      : payload.amount;

  if (
    typeof rawAmount !== 'number' ||
    !Number.isFinite(rawAmount) ||
    !Number.isInteger(rawAmount) ||
    rawAmount <= 0
  ) {
    const err = new Error('amountDinars must be a positive integer');
    err.statusCode = 400;
    throw err;
  }

  if (rawAmount > Number.MAX_SAFE_INTEGER) {
    const err = new Error('amountDinars exceeds maximum allowed value');
    err.statusCode = 400;
    throw err;
  }

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
  const amountCentimes = rawAmount * 100;

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
    amountDinars: rawAmount,
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
  _testFailureAfterBalanceUpdate = false,
}, dbClient = db) {
  // Validate password input
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

  // Fetch customer user
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

  // Password verification: bcrypt.compare
  const isPasswordValid = await bcrypt.compare(password, customerUser.passwordHash);
  if (!isPasswordValid) {
    const err = new Error('Invalid password');
    err.statusCode = 401;
    throw err;
  }

  // Lookup payment request
  if (!code || typeof code !== 'string' || code.trim() === '') {
    const err = new Error('Payment request not found');
    err.statusCode = 404;
    throw err;
  }

  const trimmedCode = code.trim();

  const [paymentRequest] = await dbClient
    .select()
    .from(paymentRequests)
    .where(eq(paymentRequests.code, trimmedCode))
    .limit(1);

  if (!paymentRequest) {
    const err = new Error('Payment request not found');
    err.statusCode = 404;
    throw err;
  }

  if (paymentRequest.status === 'completed') {
    const err = new Error('Payment code already used');
    err.statusCode = 400;
    throw err;
  }

  const isExpired =
    paymentRequest.status === 'expired' ||
    new Date() > new Date(paymentRequest.expiresAt);

  if (isExpired) {
    if (paymentRequest.status === 'pending') {
      await dbClient
        .update(paymentRequests)
        .set({ status: 'expired' })
        .where(eq(paymentRequests.id, paymentRequest.id));
    }
    const err = new Error('Payment code has expired');
    err.statusCode = 400;
    throw err;
  }

  // Self-payment check
  if (paymentRequest.merchantId === customerUserId) {
    const err = new Error('Cannot pay yourself');
    err.statusCode = 400;
    throw err;
  }

  // Atomic transaction
  return await dbClient.transaction(async (tx) => {
    // 1. Re-check & lock payment request
    const [lockedRequest] = await tx
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.id, paymentRequest.id))
      .for('update');

    if (!lockedRequest || lockedRequest.status === 'completed') {
      const err = new Error('Payment code already used');
      err.statusCode = 400;
      throw err;
    }

    if (
      lockedRequest.status === 'expired' ||
      new Date() > new Date(lockedRequest.expiresAt)
    ) {
      if (lockedRequest.status === 'pending') {
        await tx
          .update(paymentRequests)
          .set({ status: 'expired' })
          .where(eq(paymentRequests.id, lockedRequest.id));
      }
      const err = new Error('Payment code has expired');
      err.statusCode = 400;
      throw err;
    }

    // 2. Fetch merchant user
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

    // 3. Ensure wallets exist (initial balance 0)
    let [customerWallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.userId, customerUserId))
      .limit(1);

    if (!customerWallet) {
      [customerWallet] = await tx
        .insert(wallets)
        .values({
          userId: customerUserId,
          balance: 0,
        })
        .returning();
    }

    let [merchantWallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.userId, merchantUser.id))
      .limit(1);

    if (!merchantWallet) {
      [merchantWallet] = await tx
        .insert(wallets)
        .values({
          userId: merchantUser.id,
          balance: 0,
        })
        .returning();
    }

    // 4. Deterministic row-level locking: lower wallet ID first
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

    // 5. Check customer balance
    const currentCustomerBalance = Number(lockedCustomerWallet.balance);
    const paymentAmountCentimes = Number(lockedRequest.amount);

    if (currentCustomerBalance < paymentAmountCentimes) {
      const err = new Error('Insufficient customer balance');
      err.statusCode = 400;
      throw err;
    }

    // 6. Balance updates
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

    // Hook for rollback testing
    if (_testFailureAfterBalanceUpdate) {
      throw new Error('Simulated failure during payment confirmation');
    }

    // 7. Update payment request status to completed
    await tx
      .update(paymentRequests)
      .set({ status: 'completed' })
      .where(eq(paymentRequests.id, lockedRequest.id));

    // 8. Immutable ledger entry in transactions
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

    return {
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
  });
}
