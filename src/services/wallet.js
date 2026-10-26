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

