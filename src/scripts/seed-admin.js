import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, pool } from '../db/index.js';
import { users, wallets } from '../db/schema.js';

export async function seedAdmin(options = {}) {
  const phone = options.phone || process.env.ADMIN_PHONE || '0555000000';
  const password = options.password || process.env.ADMIN_PASSWORD || 'Admin1234!';
  const name = options.name || process.env.ADMIN_NAME || 'Platform Admin';

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (existingUser) {
    // Ensure wallet exists for existing admin
    const [existingWallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, existingUser.id))
      .limit(1);

    if (!existingWallet) {
      await db.insert(wallets).values({
        userId: existingUser.id,
        balance: 0,
      });
    }

    console.log(`Admin account (${phone}) already exists. Seed is idempotent.`);
    return existingUser;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [newUser] = await db
    .insert(users)
    .values({
      phone,
      name,
      passwordHash,
      role: 'admin',
      isVerified: true,
    })
    .returning();

  await db.insert(wallets).values({
    userId: newUser.id,
    balance: 0,
  });

  console.log(`Admin account created successfully with phone ${phone}.`);
  return newUser;
}

// Execute when invoked directly from CLI
const isDirectRun = process.argv[1] && (
  process.argv[1].replace(/\\/g, '/').endsWith('src/scripts/seed-admin.js') ||
  process.argv[1].replace(/\\/g, '/').endsWith('src/scripts/seed-admin')
);

if (isDirectRun) {
  seedAdmin()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Failed to seed admin:', err);
      await pool.end();
      process.exit(1);
    });
}
