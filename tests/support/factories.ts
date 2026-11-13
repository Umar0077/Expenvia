/** Test data factories for integration tests (test database only). */
import { db } from "@/server/db";
import type { Actor } from "@/server/auth/session";

export const uid = () => crypto.randomUUID().slice(0, 8);

export async function makeAdmin(): Promise<Actor> {
  const u = await db.user.create({
    data: { email: `admin-${uid()}@test.local`, fullName: "Test Admin", passwordHash: "x", role: "SUPER_ADMIN", status: "ACTIVE" },
  });
  return { sessionId: crypto.randomUUID(), userId: u.id, role: "SUPER_ADMIN", fullName: u.fullName, email: u.email };
}

export async function makeBranch(adminId: string, status: "ACTIVE" | "INACTIVE" = "ACTIVE") {
  return db.branch.create({ data: { code: `T${uid()}`.toUpperCase().slice(0, 10), name: `Branch ${uid()}`, city: "Lahore", country: "Pakistan", createdById: adminId, status } });
}

export async function makeCategory() {
  return db.expenseCategory.upsert({ where: { key: "test-cat" }, create: { key: "test-cat", nameEn: "Test", nameUr: "ٹیسٹ" }, update: {} });
}

export async function makeEmployee(adminId: string, branchId: string | null): Promise<Actor> {
  const u = await db.user.create({
    data: { email: `emp-${uid()}@test.local`, fullName: "Test Employee", passwordHash: "x", role: "USER", status: "ACTIVE" },
  });
  if (branchId) await db.userBranchAssignment.create({ data: { userId: u.id, branchId, assignedById: adminId } });
  return { sessionId: crypto.randomUUID(), userId: u.id, role: "USER", fullName: u.fullName, email: u.email };
}

export async function makeVendor(adminId: string, branchIds: string[]): Promise<Actor & { vendorId: string }> {
  const u = await db.user.create({
    data: { email: `ven-${uid()}@test.local`, fullName: "Test Vendor", passwordHash: "x", role: "VENDOR", status: "ACTIVE" },
  });
  const v = await db.vendorProfile.create({ data: { userId: u.id, businessName: `Vendor ${uid()}`, contactPerson: "C", businessEmail: u.email } });
  if (branchIds.length) await db.vendorBranchAssignment.createMany({ data: branchIds.map((branchId) => ({ vendorId: v.id, branchId, assignedById: adminId })) });
  return { sessionId: crypto.randomUUID(), userId: u.id, role: "VENDOR", fullName: u.fullName, email: u.email, vendorId: v.id };
}
