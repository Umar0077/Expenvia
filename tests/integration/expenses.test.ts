import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { reviewExpenses, saveExpense, submitExpense } from "@/server/services/expense-service";
import { approvedTotals } from "@/server/services/reporting-service";
import { makeAdmin, makeBranch, makeCategory, makeEmployee } from "../support/factories";

afterAll(() => db.$disconnect());

async function setup() {
  const admin = await makeAdmin();
  const branch = await makeBranch(admin.userId);
  const cat = await makeCategory();
  const alice = await makeEmployee(admin.userId, branch.id);
  const bob = await makeEmployee(admin.userId, branch.id);
  const data = (amount = "1250.50") => ({ categoryId: cat.id, title: "Printer toner", amount, currency: "PKR" as const, expenseDate: "2026-11-01" });
  return { admin, branch, cat, alice, bob, data };
}

describe("employee expenses", () => {
  it("creates a draft on the employee's own branch with a sequential number", async () => {
    const { alice, branch, data } = await setup();
    const e = await saveExpense(alice, { data: data(), submit: false });
    expect(e.status).toBe("DRAFT");
    expect(e.branchId).toBe(branch.id);
    expect(e.number).toMatch(/^EXP-EXP-\d{4}-\d{6}$/);
    expect(e.amount.toFixed(2)).toBe("1250.50");
  });

  it("employees without a branch cannot record expenses", async () => {
    const { admin, data } = await setup();
    const loner = await makeEmployee(admin.userId, null);
    await expect(saveExpense(loner, { data: data(), submit: false })).rejects.toThrow("noBranch");
  });

  it("another employee can neither edit nor submit someone else's expense", async () => {
    const { alice, bob, data } = await setup();
    const e = await saveExpense(alice, { data: data(), submit: false });
    await expect(saveExpense(bob, { id: e.id, version: e.version, data: data("1.00"), submit: false })).rejects.toThrow("notAllowed");
    await expect(submitExpense(bob, e.id)).rejects.toThrow("notAllowed");
    expect(await db.auditLog.count({ where: { entityId: e.id, outcome: "DENIED", actorId: bob.userId } })).toBeGreaterThan(0);
  });

  it("submitted expenses are locked; revision unlocks; stale versions are rejected", async () => {
    const { alice, admin, data } = await setup();
    const e = await saveExpense(alice, { data: data(), submit: true });
    expect(e.status).toBe("SUBMITTED");
    await expect(saveExpense(alice, { id: e.id, version: e.version, data: data("9.99"), submit: false })).rejects.toThrow("notAllowed");

    await reviewExpenses(admin, { ids: [e.id], decision: "REVISION_REQUESTED", note: "Attach the receipt" });
    const r = await db.expense.findUniqueOrThrow({ where: { id: e.id } });
    expect(r.status).toBe("REVISION_REQUESTED");
    await expect(saveExpense(alice, { id: e.id, version: r.version - 1, data: data("9.99"), submit: false })).rejects.toThrow("staleRecord");
    const revised = await saveExpense(alice, { id: e.id, version: r.version, data: data("999.00"), submit: true });
    expect(revised.status).toBe("SUBMITTED");
    expect(revised.amount.toFixed(2)).toBe("999.00");
  });

  it("rejection and revision require a reason", async () => {
    const { alice, admin, data } = await setup();
    const e = await saveExpense(alice, { data: data(), submit: true });
    await expect(reviewExpenses(admin, { ids: [e.id], decision: "REJECTED" })).rejects.toThrow("noteRequired");
  });

  it("concurrent approvals of the same expense succeed exactly once", async () => {
    const { alice, admin, data } = await setup();
    const e = await saveExpense(alice, { data: data(), submit: true });
    const results = await Promise.allSettled([
      reviewExpenses(admin, { ids: [e.id], decision: "APPROVED" }),
      reviewExpenses(admin, { ids: [e.id], decision: "APPROVED" }),
      reviewExpenses(admin, { ids: [e.id], decision: "REJECTED", note: "dup" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const history = await db.expenseStatusHistory.count({ where: { expenseId: e.id, toStatus: { in: ["APPROVED", "REJECTED"] } } });
    expect(history).toBe(1);
  });

  it("employees cannot review expenses", async () => {
    const { alice, bob, data } = await setup();
    const e = await saveExpense(alice, { data: data(), submit: true });
    await expect(reviewExpenses(bob, { ids: [e.id], decision: "APPROVED" })).rejects.toThrow("notAllowed");
  });

  it("only APPROVED expenses count toward approved spending", async () => {
    const { alice, admin, branch, data } = await setup();
    const period = { from: new Date("2026-11-01T00:00:00Z"), to: new Date("2026-11-30T00:00:00Z") };
    await saveExpense(alice, { data: data("100.00"), submit: false }); // draft
    const s = await saveExpense(alice, { data: data("200.00"), submit: true }); // submitted
    const a = await saveExpense(alice, { data: data("300.25"), submit: true });
    const r = await saveExpense(alice, { data: data("400.00"), submit: true });
    await reviewExpenses(admin, { ids: [a.id], decision: "APPROVED" });
    await reviewExpenses(admin, { ids: [r.id], decision: "REJECTED", note: "Personal" });
    expect(s.status).toBe("SUBMITTED");
    const totals = await approvedTotals(period, [branch.id]);
    expect(totals.employee).toBe("300.25");
  });

  it("notifies the owner and admins at the right moments", async () => {
    const { alice, admin, data } = await setup();
    const e = await saveExpense(alice, { data: data(), submit: true });
    expect(await db.notification.count({ where: { userId: admin.userId, type: "expense_submitted", entityId: e.id } })).toBe(1);
    await reviewExpenses(admin, { ids: [e.id], decision: "APPROVED" });
    expect(await db.notification.count({ where: { userId: alice.userId, type: "expense_approved", entityId: e.id } })).toBe(1);
  });
});
