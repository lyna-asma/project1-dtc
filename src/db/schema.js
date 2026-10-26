import { pgTable, serial, text, timestamp, boolean, bigint, integer, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  phone: text('phone').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['customer', 'merchant', 'admin'] }).notNull().default('customer'),
  isVerified: boolean('is_verified').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const otpCodes = pgTable('otp_codes', {
  id: serial('id').primaryKey(),
  phone: text('phone').notNull(),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const wallets = pgTable(
  'wallets',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .unique()
      .references(() => users.id),
    balance: bigint('balance', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    check('balance_non_negative', sql`${table.balance} >= 0`),
  ]
);

export const transactions = pgTable(
  'transactions',
  {
    id: serial('id').primaryKey(),
    type: text('type', {
      enum: ['admin_load', 'top_up', 'payment', 'transfer', 'reversal'],
    }).notNull(),
    fromWalletId: integer('from_wallet_id').references(() => wallets.id),
    toWalletId: integer('to_wallet_id').references(() => wallets.id),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    feeAmount: bigint('fee_amount', { mode: 'number' }).notNull().default(0),
    status: text('status', {
      enum: ['completed', 'reversed'],
    }).notNull().default('completed'),
    referenceId: integer('reference_id'),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    check('amount_positive', sql`${table.amount} > 0`),
  ]
);

export const paymentRequests = pgTable(
  'payment_requests',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull().unique(),
    merchantId: integer('merchant_id')
      .notNull()
      .references(() => users.id),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    status: text('status', {
      enum: ['pending', 'completed', 'expired'],
    }).notNull().default('pending'),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    check('payment_request_amount_positive', sql`${table.amount} > 0`),
  ]
);


