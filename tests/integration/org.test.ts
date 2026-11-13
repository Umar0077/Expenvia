import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import * as org from "@/server/services/org-service";
import { makeAdmin, makeBranch, makeCategory, makeEmployee, makeVendor, uid } from "../support/factories";

afterAll(() => db.$disconnect());

const branchInput = (code = `B-${uid()}`.toUpperCase().slice(0, 10)) => ({ code, name: "Gulberg Office", city: "Lahore", country: "Pakistan" });

describe("branch management", () => {
  it("creates branches with unique codes and audits it", async () => {
    const admin = await makeAdmin();
    const b = await org.createBranch(admin, branchInput());
    expect(b.status).toBe("ACTIVE");
    await expect(org.createBranch(admin, branchInput(b.code))).rejects.toMatchObject({ code: "P2002" });
    expect(await db.auditLog.count({ where: { action: "branch.created", entityId: b.id, actorId: admin.userId } })).toBe(1);
  });

  it("records field-level changes on update", async () => {
    const admin = await makeAdmin();
    const b = await org.createBranch(admin, branchInput());
    await org.updateBranch(admin, b.id, { ...branchInput(b.code), city: "Karachi" });
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "branch.updated", entityId: b.id } });
    expect(log.summary).toMatchObject({ city: { from: "Lahore", to: "Karachi" } });
  });

  it("deactivation keeps historical expenses and blocks new assignments", async () => {
    const admin = await makeAdmin();
    const b = await makeBranch(admin.userId);
    const emp = await makeEmployee(admin.userId, b.id);
    const cat = await makeCategory();
    await db.expense.create({ data: { number: `T-${uid()}`, ownerId: emp.userId, branchId: b.id, categoryId: cat.id, title: "Paper", amount: "500.00", expenseDate: new Date(), status: "APPROVED" } });
    await org.setBranchStatus(admin, b.id, "INACTIVE");
    expect(await db.expense.count({ where: { branchId: b.id } })).toBe(1);
    const other = await makeEmployee(admin.userId, null);
    await expect(org.assignEmployeeBranch(admin, other.userId, b.id)).rejects.toThrow("branchInactive");
  });
});

describe("employee reassignment", () => {
  it("keeps the original branch on past expenses and records history", async () => {
    const admin = await makeAdmin();
    const [b1, b2] = [await makeBranch(admin.userId), await makeBranch(admin.userId)];
    const emp = await makeEmployee(admin.userId, b1.id);
    const cat = await makeCategory();
    const old = await db.expense.create({ data: { number: `T-${uid()}`, ownerId: emp.userId, branchId: b1.id, categoryId: cat.id, title: "Taxi", amount: "750.00", expenseDate: new Date() } });

    await org.assignEmployeeBranch(admin, emp.userId, b2.id);

    expect((await db.expense.findUniqueOrThrow({ where: { id: old.id } })).branchId).toBe(b1.id);
    const assignments = await db.userBranchAssignment.findMany({ where: { userId: emp.userId }, orderBy: { startedAt: "asc" } });
    expect(assignments).toHaveLength(2);
    expect(assignments[0]!.endedAt).not.toBeNull();
    expect(assignments[1]!.branchId).toBe(b2.id);
    expect(await db.auditLog.count({ where: { action: "user.branch_assigned", entityId: emp.userId } })).toBe(1);
    expect(await db.notification.count({ where: { userId: emp.userId, type: "branch_assigned" } })).toBe(1);
  });
});

describe("vendor coverage", () => {
  it("adds and removes branch assignments without touching invoices", async () => {
    const admin = await makeAdmin();
    const [b1, b2] = [await makeBranch(admin.userId), await makeBranch(admin.userId)];
    const v = await makeVendor(admin.userId, [b1.id]);
    await org.addVendorBranch(admin, v.vendorId, b2.id);
    await org.addVendorBranch(admin, v.vendorId, b2.id); // idempotent
    expect(await db.vendorBranchAssignment.count({ where: { vendorId: v.vendorId, removedAt: null } })).toBe(2);

    const inv = await db.invoice.create({ data: { number: `T-${uid()}`, vendorId: v.vendorId, branchId: b1.id, invoiceDate: new Date(), status: "SUBMITTED" } });
    await org.removeVendorBranch(admin, v.vendorId, b1.id);
    expect(await db.vendorBranchAssignment.count({ where: { vendorId: v.vendorId, removedAt: null } })).toBe(1);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: inv.id } })).branchId).toBe(b1.id);
  });
});

describe("account suspension", () => {
  it("revokes sessions immediately and cannot target admins or self", async () => {
    const admin = await makeAdmin();
    const emp = await makeEmployee(admin.userId, null);
    await db.session.create({ data: { userId: emp.userId, tokenHash: `h-${uid()}`, expiresAt: new Date(Date.now() + 3600_000) } });
    await org.setAccountSuspended(admin, emp.userId, true);
    expect((await db.user.findUniqueOrThrow({ where: { id: emp.userId } })).status).toBe("SUSPENDED");
    expect(await db.session.count({ where: { userId: emp.userId, revokedAt: null } })).toBe(0);
    await org.setAccountSuspended(admin, emp.userId, false);
    expect((await db.user.findUniqueOrThrow({ where: { id: emp.userId } })).status).toBe("ACTIVE");

    const other = await makeAdmin();
    await expect(org.setAccountSuspended(admin, other.userId, true)).rejects.toThrow("notAllowed");
    await expect(org.setAccountSuspended(admin, admin.userId, true)).rejects.toThrow("notAllowed");
  });
});
