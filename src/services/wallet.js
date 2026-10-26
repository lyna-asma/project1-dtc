import { eq, or, desc, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, wallets, transactions } from '../db/schema.js';

/**
 * Retrieve wallet by user ID
 */
export async function getWalletByUserId(userId, dbClient = db) {
  const [wallet] = await dbClient
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);

  return wallet || null;
}

/**
 * Get customer balance in centimes and integer dinars
 */
export async function getCustomerBalance(userId, dbClient = db) {
  const wallet = await getWalletByUserId(userId, dbClient);

  if (!wallet) {
    return {
      balanceDinars: 0,
      balanceCentimes: 0,
    };
  }

  const balanceCentimes = Number(wallet.balance);
  const balanceDinars = Math.floor(balanceCentimes / 100);

  return {
    balanceDinars,
    balanceCentimes,
  };
}

/**
 * Get customer transaction history with direction and counterparty
 */
export async function getCustomerTransactions(userId, dbClient = db) {
  const wallet = await getWalletByUserId(userId, dbClient);

  if (!wallet) {
    return [];
  }

  const txRows = await dbClient
    .select()
    .from(transactions)
    .where(
      or(
        eq(transactions.fromWalletId, wallet.id),
        eq(transactions.toWalletId, wallet.id)
      )
    )
    .orderBy(desc(transactions.createdAt), desc(transactions.id));

  if (txRows.length === 0) {
    return [];
  }

  // Collect all unique counterparty wallet IDs
  const counterpartyWalletIds = [
    ...new Set(
      txRows
        .map((tx) => (tx.toWalletId === wallet.id ? tx.fromWalletId : tx.toWalletId))
        .filter((id) => id !== null && id !== undefined)
    ),
  ];

  const counterpartyMap = new Map();

  if (counterpartyWalletIds.length > 0) {
    const counterpartyUsers = await dbClient
      .select({
        walletId: wallets.id,
        name: users.name,
        phone: users.phone,
      })
      .from(wallets)
      .innerJoin(users, eq(wallets.userId, users.id))
      .where(inArray(wallets.id, counterpartyWalletIds));

    for (const row of counterpartyUsers) {
      counterpartyMap.set(row.walletId, {
        name: row.name,
        phone: row.phone,
      });
    }
  }

  return txRows.map((tx) => {
    const direction = tx.toWalletId === wallet.id ? 'in' : 'out';
    const counterpartyWalletId = direction === 'in' ? tx.fromWalletId : tx.toWalletId;
    const counterparty = counterpartyWalletId
      ? counterpartyMap.get(counterpartyWalletId) || null
      : null;

    const amountCentimes = Number(tx.amount);
    const amountDinars = Math.floor(amountCentimes / 100);

    return {
      id: tx.id,
      type: tx.type,
      amountCentimes,
      amountDinars,
      direction,
      status: tx.status,
      description: tx.description ?? null,
      createdAt: tx.createdAt instanceof Date ? tx.createdAt.toISOString() : tx.createdAt,
      counterparty,
    };
  });
}

/**
 * Record a new transaction in the append-only ledger
 * Note: Only INSERT is supported; ledger rows are never updated or deleted.
 */
export async function recordTransaction({
  type,
  fromWalletId = null,
  toWalletId = null,
  amount,
  feeAmount = 0,
  status = 'completed',
  referenceId = null,
  description = null,
}, dbClient = db) {
  const [createdTx] = await dbClient
    .insert(transactions)
    .values({
      type,
      fromWalletId,
      toWalletId,
      amount,
      feeAmount,
      status,
      referenceId,
      description,
    })
    .returning();

  return createdTx;
}

/**
 * Load shop balance by admin inside an atomic database transaction
 */
export async function adminLoadShopBalance({
  merchantId,
  amountDinars,
  description,
  _testFailureAfterBalanceUpdate = false,
}, dbClient = db) {
  // Validate merchantId
  const merchantIdStr = String(merchantId);
  const isPositiveIntegerString = /^[1-9]\d*$/.test(merchantIdStr);
  const parsedMerchantId = Number(merchantIdStr);

  if (!isPositiveIntegerString || !Number.isSafeInteger(parsedMerchantId)) {
    const err = new Error('Invalid merchant ID');
    err.statusCode = 400;
    throw err;
  }

  // Validate amountDinars
  if (amountDinars === undefined) {
    const err = new Error('amountDinars is required');
    err.statusCode = 400;
    throw err;
  }

  if (
    typeof amountDinars !== 'number' ||
    !Number.isInteger(amountDinars) ||
    amountDinars <= 0
  ) {
    const err = new Error('amountDinars must be a positive integer');
    err.statusCode = 400;
    throw err;
  }

  if (amountDinars > Number.MAX_SAFE_INTEGER) {
    const err = new Error('amountDinars exceeds maximum allowed value');
    err.statusCode = 400;
    throw err;
  }

  return await dbClient.transaction(async (tx) => {
    // 1. Verify merchant exists
    const [targetUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, parsedMerchantId))
      .limit(1);

    if (!targetUser) {
      const err = new Error('Merchant not found');
      err.statusCode = 404;
      throw err;
    }

    // 2. Verify target user has role 'merchant'
    if (targetUser.role !== 'merchant') {
      const err = new Error('Target user is not a merchant');
      err.statusCode = 400;
      throw err;
    }

    // 3. Find or create merchant wallet (initial balance = 0)
    let [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.userId, targetUser.id))
      .limit(1);

    if (!wallet) {
      [wallet] = await tx
        .insert(wallets)
        .values({
          userId: targetUser.id,
          balance: 0,
        })
        .returning();
    }

    // 4. Update wallet balance: integer centimes math
    const amountCentimes = amountDinars * 100;

    const [updatedWallet] = await tx
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} + ${amountCentimes}`,
      })
      .where(eq(wallets.id, wallet.id))
      .returning();

    // Hook to test transaction rollback
    if (_testFailureAfterBalanceUpdate) {
      throw new Error('Simulated failure after balance update');
    }

    // 5. Append-only ledger record in transactions
    const finalDescription =
      typeof description === 'string' && description.trim()
        ? description.trim()
        : 'Admin shop balance load';

    const [createdTx] = await tx
      .insert(transactions)
      .values({
        type: 'admin_load',
        fromWalletId: null,
        toWalletId: wallet.id,
        amount: amountCentimes,
        feeAmount: 0,
        status: 'completed',
        description: finalDescription,
      })
      .returning();

    const finalBalanceCentimes = Number(updatedWallet.balance);
    const finalBalanceDinars = Math.floor(finalBalanceCentimes / 100);

    return {
      message: 'Shop balance loaded successfully',
      transaction: {
        id: createdTx.id,
        type: createdTx.type,
        amountDinars,
        amountCentimes,
        toWalletId: createdTx.toWalletId,
        createdAt:
          createdTx.createdAt instanceof Date
            ? createdTx.createdAt.toISOString()
            : new Date(createdTx.createdAt).toISOString(),
      },
      shop: {
        id: targetUser.id,
        name: targetUser.name,
        phone: targetUser.phone,
        balanceDinars: finalBalanceDinars,
        balanceCentimes: finalBalanceCentimes,
      },
    };
  });
}

/**
 * Top up a customer's wallet from merchant shop balance inside an atomic database transaction
 */
export async function merchantTopUp({
  merchantUserId,
  customerPhone,
  amountDinars,
  amount,
  body,
  _testFailureAfterBalanceUpdate = false,
}, dbClient = db) {
  const payload = body || {};

  // Extract customerPhone input
  const phoneInput =
    customerPhone !== undefined
      ? customerPhone
      : Object.prototype.hasOwnProperty.call(payload, 'customerPhone')
        ? payload.customerPhone
        : undefined;

  if (
    phoneInput === undefined ||
    phoneInput === null ||
    (typeof phoneInput === 'string' && phoneInput.trim() === '')
  ) {
    const err = new Error('customerPhone is required');
    err.statusCode = 400;
    throw err;
  }

  if (typeof phoneInput !== 'string') {
    const err = new Error('Invalid customer phone number');
    err.statusCode = 400;
    throw err;
  }

  const trimmedCustomerPhone = phoneInput.trim();

  // Extract amount input
  const hasAmountDinars =
    amountDinars !== undefined ||
    (Object.prototype.hasOwnProperty.call(payload, 'amountDinars') && payload.amountDinars !== undefined);

  const hasAmount =
    amount !== undefined ||
    (Object.prototype.hasOwnProperty.call(payload, 'amount') && payload.amount !== undefined);

  if (!hasAmountDinars && !hasAmount) {
    const err = new Error('amountDinars is required');
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
    const err = new Error('Amount must be a positive integer');
    err.statusCode = 400;
    throw err;
  }

  if (rawAmount > Number.MAX_SAFE_INTEGER) {
    const err = new Error('Amount exceeds maximum allowed value');
    err.statusCode = 400;
    throw err;
  }

  const finalAmountDinars = rawAmount;
  const finalAmountCentimes = finalAmountDinars * 100;

  return await dbClient.transaction(async (tx) => {
    // 1. Merchant user lookup & role check
    const [merchantUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, merchantUserId))
      .limit(1);

    if (!merchantUser) {
      const err = new Error('Merchant not found');
      err.statusCode = 404;
      throw err;
    }

    if (merchantUser.role !== 'merchant') {
      const err = new Error('Insufficient permissions');
      err.statusCode = 403;
      throw err;
    }

    // 2. Reject self top-up (merchant's own phone)
    if (merchantUser.phone === trimmedCustomerPhone) {
      const err = new Error('Cannot top up your own shop');
      err.statusCode = 400;
      throw err;
    }

    // 3. Customer user lookup
    const [customerUser] = await tx
      .select()
      .from(users)
      .where(eq(users.phone, trimmedCustomerPhone))
      .limit(1);

    if (!customerUser) {
      const err = new Error('Customer not found');
      err.statusCode = 404;
      throw err;
    }

    // Reject self top-up if customer ID matches merchant ID
    if (customerUser.id === merchantUser.id) {
      const err = new Error('Cannot top up your own shop');
      err.statusCode = 400;
      throw err;
    }

    if (!customerUser.isVerified) {
      const err = new Error('Customer account is not verified');
      err.statusCode = 400;
      throw err;
    }

    if (customerUser.role !== 'customer') {
      const err = new Error('Target user is not a customer');
      err.statusCode = 400;
      throw err;
    }

    // 4. Ensure merchant wallet exists (initial balance 0)
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

    // 5. Ensure customer wallet exists (initial balance 0)
    let [customerWallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.userId, customerUser.id))
      .limit(1);

    if (!customerWallet) {
      [customerWallet] = await tx
        .insert(wallets)
        .values({
          userId: customerUser.id,
          balance: 0,
        })
        .returning();
    }

    // 6. Deterministic row-level lock ordering: lower wallet ID first
    const walletIdsInOrder = [merchantWallet.id, customerWallet.id].sort((a, b) => a - b);
    const lockedWalletsMap = new Map();
    for (const wid of walletIdsInOrder) {
      const [locked] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.id, wid))
        .for('update');
      lockedWalletsMap.set(wid, locked);
    }

    const lockedMerchantWallet = lockedWalletsMap.get(merchantWallet.id);

    // 7. Check shop balance sufficiency
    const currentShopBalance = Number(lockedMerchantWallet.balance);
    if (currentShopBalance < finalAmountCentimes) {
      const err = new Error('Insufficient shop balance');
      err.statusCode = 400;
      throw err;
    }

    // 8. Deduct shop balance and credit customer balance using integer centimes
    const [updatedShopWallet] = await tx
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} - ${finalAmountCentimes}`,
      })
      .where(eq(wallets.id, merchantWallet.id))
      .returning();

    const [updatedCustomerWallet] = await tx
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} + ${finalAmountCentimes}`,
      })
      .where(eq(wallets.id, customerWallet.id))
      .returning();

    // Hook to test transaction rollback
    if (_testFailureAfterBalanceUpdate) {
      throw new Error('Simulated failure after balance update');
    }

    // 9. Append-only ledger record in transactions
    const [createdTx] = await tx
      .insert(transactions)
      .values({
        type: 'top_up',
        fromWalletId: merchantWallet.id,
        toWalletId: customerWallet.id,
        amount: finalAmountCentimes,
        feeAmount: 0,
        status: 'completed',
        description: 'Cash top-up from shop',
      })
      .returning();

    const newShopBalanceCentimes = Number(updatedShopWallet.balance);
    const newShopBalanceDinars = Math.floor(newShopBalanceCentimes / 100);

    return {
      message: 'Top-up successful',
      amountDinars: finalAmountDinars,
      amountCentimes: finalAmountCentimes,
      newShopBalanceDinars,
      newShopBalanceCentimes,
      customerPhone: customerUser.phone,
      customerName: customerUser.name,
      transaction: {
        id: createdTx.id,
        type: createdTx.type,
        amountDinars: finalAmountDinars,
        amountCentimes: finalAmountCentimes,
        fromWalletId: createdTx.fromWalletId,
        toWalletId: createdTx.toWalletId,
        status: createdTx.status,
        createdAt:
          createdTx.createdAt instanceof Date
            ? createdTx.createdAt.toISOString()
            : new Date(createdTx.createdAt).toISOString(),
      },
    };
  });
}


