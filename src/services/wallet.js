import { eq, or, desc, inArray } from 'drizzle-orm';
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
