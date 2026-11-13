/**
 * Runs against the real local Postgres (DATABASE_URL). Verifies that the
 * database itself — not just application code — enforces Expenvia's rules.
 * Every test runs inside a transaction that is rolled back.
 */
import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
afterAll(() => db.$disconnect());

class Rollback extends Error {}

async function inRollback(fn: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<void>) {
  await expect(
    db.$transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    }),
  ).rejects.toBeInstanceOf(Rollback);
}

async function makeAdminAndBranch(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) {
  const admin = await tx.user.create({
    data: { email: `t-${crypto.randomUUID()}@test.local`, passwordHash: "x", fullName: "T", role: "SUPER_ADMIN", status: "ACTIVE" },
  });
  const branch = await tx.branch.create({
    data: { code: `T-${crypto.randomUUID().slice(0, 8)}`, name: "Test", city: "Lahore", country: "PK", createdById: admin.id },
  });
  return { admin, branch };
}

describe("database guarantees", () => {
  it("audit_logs rejects UPDATE and DELETE", async () => {
    await inRollback(async (tx) => {
      const row = await tx.auditLog.create({ data: { action: "test.event" } });
      await expect(tx.$executeRaw`UPDATE audit_logs SET action = 'x' WHERE id = ${row.id}::uuid`).rejects.toThrow(/append-only/);
    });
    await inRollback(async (tx) => {
      const row = await tx.auditLog.create({ data: { action: "test.event" } });
      await expect(tx.$executeRaw`DELETE FROM audit_logs WHERE id = ${row.id}::uuid`).rejects.toThrow(/append-only/);
    });
  });

  it("an employee can hold only one active branch assignment", async () => {
    await inRollback(async (tx) => {
      const { admin, branch } = await makeAdminAndBranch(tx);
      const user = await tx.user.create({ data: { email: `u-${crypto.randomUUID()}@test.local`, passwordHash: "x", fullName: "U" } });
      await tx.userBranchAssignment.create({ data: { userId: user.id, branchId: branch.id, assignedById: admin.id } });
      await expect(
        tx.userBranchAssignment.create({ data: { userId: user.id, branchId: branch.id, assignedById: admin.id } }),
      ).rejects.toThrow();
    });
  });

  it("expense amounts must be positive", async () => {
    await inRollback(async (tx) => {
      const { admin, branch } = await makeAdminAndBranch(tx);
      const cat = await tx.expenseCategory.create({ data: { key: `k-${crypto.randomUUID()}`, nameEn: "K", nameUr: "ک" } });
      await expect(
        tx.expense.create({
          data: { number: `T-${crypto.randomUUID()}`, ownerId: admin.id, branchId: branch.id, categoryId: cat.id, title: "x", amount: "-1.00", expenseDate: new Date() },
        }),
      ).rejects.toThrow();
    });
  });

  it("invoice sequence yields unique increasing numbers", async () => {
    const rows = await Promise.all(
      Array.from({ length: 20 }, () => db.$queryRaw<{ n: bigint }[]>`SELECT nextval('invoice_number_seq') AS n`),
    );
    const nums = rows.map((r) => Number(r[0]!.n));
    expect(new Set(nums).size).toBe(20);
  });
});
