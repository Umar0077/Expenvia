/**
 * One-time Super Admin bootstrap. This is the ONLY way a SUPER_ADMIN account
 * can be created — sign-up can never request that role.
 *
 *   BOOTSTRAP_ADMIN_EMAIL=… BOOTSTRAP_ADMIN_NAME=… BOOTSTRAP_ADMIN_PASSWORD=… npm run db:bootstrap-admin
 *
 * Refuses to run if any Super Admin already exists. Also installs the default
 * expense categories (reference data, editable later by the admin).
 * Remove the BOOTSTRAP_* variables from the environment afterwards.
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const DEFAULT_CATEGORIES: [key: string, en: string, ur: string][] = [
  ["office-supplies", "Office supplies", "دفتری سامان"],
  ["utilities", "Utilities", "یوٹیلیٹیز"],
  ["maintenance", "Maintenance", "دیکھ بھال"],
  ["internet-communications", "Internet & communications", "انٹرنیٹ اور مواصلات"],
  ["transportation", "Transportation", "نقل و حمل"],
  ["office-equipment", "Office equipment", "دفتری آلات"],
  ["cleaning", "Cleaning", "صفائی"],
  ["repairs", "Repairs", "مرمت"],
  ["miscellaneous", "Miscellaneous", "متفرق"],
];

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";

  if (!email || !name) throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_NAME");
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters with letters and numbers");
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const existing = await db.user.count({ where: { role: "SUPER_ADMIN" } });
    if (existing > 0) {
      console.error("✖ A Super Admin already exists. Bootstrap refused.");
      process.exitCode = 1;
      return;
    }
    const passwordHash = await hash(password, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const admin = await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          fullName: name,
          passwordHash,
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          preferences: { create: {} },
        },
      });
      for (const [key, nameEn, nameUr] of DEFAULT_CATEGORIES) {
        await tx.expenseCategory.upsert({ where: { key }, create: { key, nameEn, nameUr, createdById: u.id }, update: {} });
      }
      await tx.auditLog.create({
        data: { actorId: u.id, actorRole: "SUPER_ADMIN", action: "system.admin_bootstrapped", entityType: "user", entityId: u.id },
      });
      return u;
    });
    console.log(`✔ Super Admin created: ${admin.email}`);
    console.log("  Remove BOOTSTRAP_ADMIN_* from your environment now.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("✖", e instanceof Error ? e.message : e);
  process.exit(1);
});
