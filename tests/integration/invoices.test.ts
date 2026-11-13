import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { correctPayment, linkExpenseToInvoice, recordPayment, reviewInvoice, saveInvoice, saveSupplyRecord } from "@/server/services/invoice-service";
import { reviewExpenses, saveExpense } from "@/server/services/expense-service";
import { approvedTotals } from "@/server/services/reporting-service";
import { renderInvoiceHtml, loadInvoiceForDocument } from "@/server/invoice-document";
import { htmlToPdf } from "@/server/pdf";
import { makeAdmin, makeBranch, makeCategory, makeEmployee, makeVendor } from "../support/factories";

afterAll(async () => {
  const g = globalThis as unknown as { __expenviaBrowser?: Promise<{ close(): Promise<void> }> };
  await (await g.__expenviaBrowser)?.close();
  await db.$disconnect();
});

const lines = [
  { itemName: "A4 paper (box)", quantity: "10", unit: "box", unitPrice: "2450.00", taxRate: "17", discount: "500" },
  { itemName: "Toner cartridge", description: "HP 85A", quantity: "2", unit: "pcs", unitPrice: "8999.99", taxRate: "0", discount: "0" },
];

async function setup() {
  const admin = await makeAdmin();
  const [b1, b2, b3] = [await makeBranch(admin.userId), await makeBranch(admin.userId), await makeBranch(admin.userId)];
  const vendorA = await makeVendor(admin.userId, [b1.id, b2.id]);
  const vendorB = await makeVendor(admin.userId, [b3.id]);
  const data = (branchId = b1.id) => ({ branchId, currency: "PKR" as const, invoiceDate: "2026-11-05", lines });
  return { admin, b1, b2, b3, vendorA, vendorB, data };
}

async function approvedInvoice() {
  const s = await setup();
  const inv = await saveInvoice(s.vendorA, { data: s.data(), submit: true });
  await reviewInvoice(s.admin, { id: inv.id, decision: "APPROVED" });
  return { ...s, inv: await db.invoice.findUniqueOrThrow({ where: { id: inv.id } }) };
}

describe("invoice creation", () => {
  it("computes totals on the server with exact decimals", async () => {
    const { vendorA, data } = await setup();
    const inv = await saveInvoice(vendorA, { data: data(), submit: false });
    // line1: 24500.00 − 500 = 24000 + 17% = 4080.00 → 28080.00 ; line2: 17999.98
    expect(inv.subtotal.toFixed(2)).toBe("42499.98");
    expect(inv.discountTotal.toFixed(2)).toBe("500.00");
    expect(inv.taxTotal.toFixed(2)).toBe("4080.00");
    expect(inv.grandTotal.toFixed(2)).toBe("46079.98");
    expect(inv.number.startsWith("DRAFT-")).toBe(true);
  });

  it("rejects invoices for unassigned branches and logs the attempt", async () => {
    const { vendorA, b3, data } = await setup();
    await expect(saveInvoice(vendorA, { data: data(b3.id), submit: false })).rejects.toThrow("notAllowed");
    expect(await db.auditLog.count({ where: { actorId: vendorA.userId, action: "invoice.branch_violation", outcome: "DENIED" } })).toBe(1);
  });

  it("a vendor cannot edit another vendor's invoice", async () => {
    const { vendorA, vendorB, data } = await setup();
    const inv = await saveInvoice(vendorA, { data: data(), submit: false });
    await expect(saveInvoice(vendorB, { id: inv.id, version: inv.version, data: data(), submit: false })).rejects.toThrow("notAllowed");
  });

  it("assigns unique sequential numbers on submission, even concurrently", async () => {
    const { vendorA, data } = await setup();
    const drafts = await Promise.all(Array.from({ length: 6 }, () => saveInvoice(vendorA, { data: data(), submit: false })));
    const submitted = await Promise.all(drafts.map((d) => saveInvoice(vendorA, { id: d.id, version: d.version, data: data(), submit: true })));
    const numbers = submitted.map((i) => i.number);
    expect(new Set(numbers).size).toBe(6);
    for (const n of numbers) expect(n).toMatch(/^EXP-INV-\d{4}-\d{6}$/);
  });

  it("locks line items after submission at the database level", async () => {
    const { vendorA, data } = await setup();
    const inv = await saveInvoice(vendorA, { data: data(), submit: true });
    await expect(db.invoiceLineItem.updateMany({ where: { invoiceId: inv.id }, data: { unitPrice: "1.00" } })).rejects.toThrow(/cannot be changed/);
    expect((inv.snapshot as { versions: unknown[] }).versions).toHaveLength(1);
  });

  it("revision keeps the number and appends a new snapshot version", async () => {
    const { vendorA, admin, data } = await setup();
    const inv = await saveInvoice(vendorA, { data: data(), submit: true });
    await reviewInvoice(admin, { id: inv.id, decision: "REVISION_REQUESTED", note: "Wrong rate" });
    const r = await db.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    const revised = await saveInvoice(vendorA, { id: inv.id, version: r.version, data: { ...data(), lines: [lines[1]!] }, submit: true });
    expect(revised.number).toBe(inv.number);
    expect((revised.snapshot as { versions: unknown[] }).versions).toHaveLength(2);
    expect(revised.grandTotal.toFixed(2)).toBe("17999.98");
  });

  it("supply records can only target assigned branches", async () => {
    const { vendorA, b1, b3 } = await setup();
    const ok = await saveSupplyRecord(vendorA, { branchId: b1.id, supplyDate: "2026-11-01", itemName: "Chairs", quantity: "4", unit: "pcs", unitPrice: "5500" });
    expect(ok.branchId).toBe(b1.id);
    await expect(saveSupplyRecord(vendorA, { branchId: b3.id, supplyDate: "2026-11-01", itemName: "Chairs", quantity: "4", unit: "pcs", unitPrice: "5500" })).rejects.toThrow("notAllowed");
  });
});

describe("approval and payments", () => {
  it("approval is not payment; only approved invoices accept payments", async () => {
    const { vendorA, admin, data } = await setup();
    const inv = await saveInvoice(vendorA, { data: data(), submit: true });
    await expect(recordPayment(admin, { invoiceId: inv.id, amount: "100", paymentDate: "2026-11-10", idempotencyKey: crypto.randomUUID() })).rejects.toThrow("notPayable");
    await reviewInvoice(admin, { id: inv.id, decision: "APPROVED" });
    const approved = await db.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(approved.status).toBe("APPROVED");
    expect(approved.amountPaid.toFixed(2)).toBe("0.00");
  });

  it("supports partial payments, then full payment, and blocks overpayment", async () => {
    const { admin, inv } = await approvedInvoice();
    await recordPayment(admin, { invoiceId: inv.id, amount: "40000.00", paymentDate: "2026-11-10", idempotencyKey: crypto.randomUUID() });
    let r = await db.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(r.status).toBe("PARTIALLY_PAID");
    await expect(recordPayment(admin, { invoiceId: inv.id, amount: "6079.99", paymentDate: "2026-11-10", idempotencyKey: crypto.randomUUID() })).rejects.toThrow("overpayment");
    await recordPayment(admin, { invoiceId: inv.id, amount: "6079.98", paymentDate: "2026-11-11", idempotencyKey: crypto.randomUUID() });
    r = await db.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(r.status).toBe("PAID");
    expect(r.amountPaid.toFixed(2)).toBe("46079.98");
  });

  it("concurrent payments can never exceed the balance", async () => {
    const { admin, inv } = await approvedInvoice();
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => recordPayment(admin, { invoiceId: inv.id, amount: "20000.00", paymentDate: "2026-11-10", idempotencyKey: crypto.randomUUID() })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    const r = await db.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(r.amountPaid.toFixed(2)).toBe("40000.00");
  });

  it("is idempotent: replaying the same key records one payment", async () => {
    const { admin, inv } = await approvedInvoice();
    const key = crypto.randomUUID();
    const a = await recordPayment(admin, { invoiceId: inv.id, amount: "1000.00", paymentDate: "2026-11-10", idempotencyKey: key });
    const b = await recordPayment(admin, { invoiceId: inv.id, amount: "1000.00", paymentDate: "2026-11-10", idempotencyKey: key });
    expect(a.id).toBe(b.id);
    expect(await db.invoicePayment.count({ where: { invoiceId: inv.id } })).toBe(1);
  });

  it("corrections are compensating entries; payments are never edited", async () => {
    const { admin, inv } = await approvedInvoice();
    const p = await recordPayment(admin, { invoiceId: inv.id, amount: "46079.98", paymentDate: "2026-11-10", idempotencyKey: crypto.randomUUID() });
    expect((await db.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("PAID");
    await correctPayment(admin, { paymentId: p.id, reason: "Bounced cheque", idempotencyKey: crypto.randomUUID() });
    const r = await db.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(r.status).toBe("APPROVED");
    expect(r.amountPaid.toFixed(2)).toBe("0.00");
    await expect(correctPayment(admin, { paymentId: p.id, reason: "again", idempotencyKey: crypto.randomUUID() })).rejects.toThrow("alreadyProcessed");
    await expect(db.$executeRaw`UPDATE invoice_payments SET amount = 1 WHERE id = ${p.id}::uuid`).rejects.toThrow(/append-only/);
  });

  it("vendors cannot approve their own invoices or record payments", async () => {
    const { vendorA, data } = await setup();
    const inv = await saveInvoice(vendorA, { data: data(), submit: true });
    await expect(reviewInvoice(vendorA, { id: inv.id, decision: "APPROVED" })).rejects.toThrow("notAllowed");
    await expect(recordPayment(vendorA, { invoiceId: inv.id, amount: "1", paymentDate: "2026-11-10", idempotencyKey: crypto.randomUUID() })).rejects.toThrow("notAllowed");
  });
});

describe("reporting avoids double counting", () => {
  it("excludes an employee expense linked as a duplicate of an approved invoice", async () => {
    const { admin, b1, inv } = await approvedInvoice();
    const cat = await makeCategory();
    const emp = await makeEmployee(admin.userId, b1.id);
    const e = await saveExpense(emp, { data: { categoryId: cat.id, title: "Same paper purchase", amount: "28080.00", expenseDate: "2026-11-05" }, submit: true });
    await reviewExpenses(admin, { ids: [e.id], decision: "APPROVED" });
    const period = { from: new Date("2026-11-01T00:00:00Z"), to: new Date("2026-11-30T00:00:00Z") };

    const before = await approvedTotals(period, [b1.id]);
    expect(before.total).toBe("74159.98"); // 46079.98 + 28080.00 — double counted until linked
    await linkExpenseToInvoice(admin, { expenseId: e.id, invoiceId: inv.id, type: "DUPLICATE_OF" });
    const after = await approvedTotals(period, [b1.id]);
    expect(after.employee).toBe("0");
    expect(after.total).toBe("46079.98");
  });
});

describe("invoice documents", () => {
  it("renders escaped HTML and a real multi-language PDF", async () => {
    const { vendorA, data } = await setup();
    const inv = await saveInvoice(vendorA, { data: { ...data(), notes: "<script>alert(1)</script> ادائیگی 30 دن" }, submit: true });
    const doc = (await loadInvoiceForDocument(inv.id))!;
    const html = await renderInvoiceHtml(doc, "ur");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('dir="rtl"');
    const pdf = await htmlToPdf(html, "صفحہ");
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(10_000);
  }, 60_000);
});
