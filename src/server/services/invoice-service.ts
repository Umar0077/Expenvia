import "server-only";
import { randomUUID } from "node:crypto";
import { db, type Tx } from "@/server/db";
import type { Actor } from "@/server/auth/session";
import type { Prisma } from "@/generated/prisma/client";
import { AccessDenied, DomainError } from "@/server/errors";
import { withDenialAudit } from "@/server/denial";
import { invoicePolicy } from "@/server/authz/policy";
import { loadSubject } from "@/server/authz/subject";
import { invoiceSchema, supplySchema, type InvoiceInput, type SupplyInput } from "@/lib/validation/invoice";
import { assertPaymentAllowed, calculateInvoice, calculateLine, dec, outstandingBalance, toFixedString } from "@/lib/finance/money";
import { notifyAdmins, notifyUsers } from "./notify";

const day = (s: string) => new Date(`${s}T00:00:00Z`);
const optDay = (s: string) => (s ? day(s) : null);

async function nextInvoiceNumber(tx: Tx): Promise<string> {
  // Postgres sequence: atomic & concurrency-safe across processes. Never client-side counting.
  const [row] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('invoice_number_seq') AS n`;
  return `EXP-INV-${new Date().getUTCFullYear()}-${String(row!.n).padStart(6, "0")}`;
}

function denial(actor: Actor, action: string, entityId: string, branchId?: string | null) {
  return new AccessDenied({ actorId: actor.userId, actorRole: actor.role, action, entityType: "invoice", entityId, branchId });
}

/** Server-side recomputation — client totals are never trusted. */
function computeLines(data: ReturnType<typeof invoiceSchema.parse>) {
  const totals = calculateInvoice(data.lines, data.currency);
  const lines = data.lines.map((l, i) => {
    const r = totals.lines[i]!;
    return {
      position: i + 1,
      itemName: l.itemName,
      description: l.description || null,
      quantity: dec(l.quantity).toFixed(4),
      unit: l.unit,
      unitPrice: dec(l.unitPrice).toFixed(4),
      taxRate: dec(l.taxRate).toFixed(4),
      discount: r.discount.toFixed(2),
      lineSubtotal: r.lineSubtotal.toFixed(2),
      lineTax: r.lineTax.toFixed(2),
      lineTotal: r.lineTotal.toFixed(2),
    };
  });
  return {
    lines,
    subtotal: totals.subtotal.toFixed(2),
    discountTotal: totals.discountTotal.toFixed(2),
    taxTotal: totals.taxTotal.toFixed(2),
    grandTotal: totals.grandTotal.toFixed(2),
  };
}

// ───────────────────────── Vendor: drafts & submission ─────────────────────────

export async function saveInvoice(actor: Actor, input: { id?: string | null; version?: number; data: InvoiceInput; submit: boolean; supplyIds?: string[] }) {
  const data = invoiceSchema.parse(input.data);
  const subject = await loadSubject(actor);
  const computed = computeLines(data);

  return withDenialAudit(() =>
    db.$transaction(async (tx) => {
      // Server-side branch authorization — a crafted request for an unassigned branch is denied and logged.
      if (!invoicePolicy.create(subject, data.branchId)) throw denial(actor, "invoice.branch_violation", input.id ?? data.branchId, data.branchId);
      const header = {
        branchId: data.branchId,
        currency: data.currency,
        invoiceDate: day(data.invoiceDate),
        supplyDate: optDay(data.supplyDate),
        dueDate: optDay(data.dueDate),
        notes: data.notes || null,
        paymentTerms: data.paymentTerms || null,
        paymentDetails: data.paymentDetails || null,
        subtotal: computed.subtotal,
        discountTotal: computed.discountTotal,
        taxTotal: computed.taxTotal,
        grandTotal: computed.grandTotal,
      };

      let invoiceId: string;
      if (!input.id) {
        const inv = await tx.invoice.create({
          data: { ...header, number: `DRAFT-${randomUUID().slice(0, 12).toUpperCase()}`, vendorId: subject.vendorId!, lineItems: { create: computed.lines } },
        });
        invoiceId = inv.id;
        await tx.invoiceStatusHistory.create({ data: { invoiceId, toStatus: "DRAFT", actorId: actor.userId } });
        await tx.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: "invoice.created", entityType: "invoice", entityId: invoiceId, branchId: data.branchId, summary: { grandTotal: computed.grandTotal, currency: data.currency, lines: computed.lines.length } } });
      } else {
        const existing = await tx.invoice.findUnique({ where: { id: input.id } });
        if (!existing || !invoicePolicy.edit(subject, existing)) throw denial(actor, "invoice.edit", input.id, existing?.branchId);
        const res = await tx.invoice.updateMany({
          where: { id: existing.id, version: input.version ?? existing.version, status: { in: ["DRAFT", "REVISION_REQUESTED"] } },
          data: { ...header, version: { increment: 1 } },
        });
        if (res.count !== 1) throw new DomainError("staleRecord");
        await tx.invoiceLineItem.deleteMany({ where: { invoiceId: existing.id } });
        await tx.invoiceLineItem.createMany({ data: computed.lines.map((l) => ({ ...l, invoiceId: existing.id })) });
        invoiceId = existing.id;
        await tx.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: existing.status === "REVISION_REQUESTED" ? "invoice.revised" : "invoice.updated", entityType: "invoice", entityId: invoiceId, branchId: data.branchId, summary: { grandTotal: computed.grandTotal } } });
      }

      if (input.supplyIds?.length) {
        const r = await tx.vendorSupplyRecord.updateMany({
          where: { id: { in: input.supplyIds }, vendorId: subject.vendorId!, branchId: data.branchId, invoiceId: null },
          data: { invoiceId },
        });
        if (r.count !== input.supplyIds.length) throw new DomainError("staleRecord");
      }

      if (input.submit) await submitWithin(tx, actor, invoiceId);
      return tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    }),
  );
}

async function submitWithin(tx: Tx, actor: Actor, id: string) {
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id }, include: { lineItems: { orderBy: { position: "asc" } }, vendor: true, branch: true } });
  if (inv.lineItems.length === 0) throw new DomainError("validationFailed");
  const isFirstSubmission = inv.number.startsWith("DRAFT-");
  const number = isFirstSubmission ? await nextInvoiceNumber(tx) : inv.number;

  // Immutable snapshot of exactly what was submitted (appended per submission).
  const prior = (inv.snapshot as { versions?: unknown[] } | null)?.versions ?? [];
  const snapshot = {
    versions: [
      ...prior,
      {
        submittedAt: new Date().toISOString(),
        number,
        vendor: { businessName: inv.vendor.businessName, contactPerson: inv.vendor.contactPerson, email: inv.vendor.businessEmail, phone: inv.vendor.businessPhone, address: inv.vendor.businessAddress, taxId: inv.vendor.taxIdentifier },
        branch: { code: inv.branch.code, name: inv.branch.name, city: inv.branch.city, address: inv.branch.address },
        currency: inv.currency,
        invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
        supplyDate: inv.supplyDate?.toISOString().slice(0, 10) ?? null,
        dueDate: inv.dueDate?.toISOString().slice(0, 10) ?? null,
        lines: inv.lineItems.map((l) => ({ itemName: l.itemName, description: l.description, quantity: l.quantity.toString(), unit: l.unit, unitPrice: l.unitPrice.toString(), taxRate: l.taxRate.toString(), discount: l.discount.toString(), lineTotal: l.lineTotal.toString() })),
        totals: { subtotal: inv.subtotal.toString(), discountTotal: inv.discountTotal.toString(), taxTotal: inv.taxTotal.toString(), grandTotal: inv.grandTotal.toString() },
      },
    ],
  };

  const res = await tx.invoice.updateMany({
    where: { id, status: { in: ["DRAFT", "REVISION_REQUESTED"] } },
    data: { status: "SUBMITTED", submittedAt: new Date(), number, snapshot: snapshot as Prisma.InputJsonValue, version: { increment: 1 } },
  });
  if (res.count !== 1) throw new DomainError("staleRecord");
  await tx.invoiceStatusHistory.create({ data: { invoiceId: id, fromStatus: inv.status, toStatus: "SUBMITTED", actorId: actor.userId } });
  await tx.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: "invoice.submitted", entityType: "invoice", entityId: id, branchId: inv.branchId, summary: { number, grandTotal: inv.grandTotal.toString(), currency: inv.currency } } });
  const emailDetails = { branch: inv.branch.name, total: `${inv.currency} ${inv.grandTotal}`, date: inv.invoiceDate.toISOString().slice(0,10), submittedAt: new Date().toISOString().slice(0,10), status: "SUBMITTED" };
  await notifyAdmins({ type: "invoice_submitted", params: { vendor: inv.vendor.businessName, number }, emailDetails, entityType: "invoice", entityId: id, href: `/admin/invoices/${id}` }, tx);
  await notifyUsers([inv.vendor.userId], { type: "invoice_submissionConfirmed", params: { number }, emailDetails, entityType: "invoice", entityId: id, href: `/vendor/invoices/${id}` }, tx);
}

export async function submitInvoice(actor: Actor, id: string) {
  const subject = await loadSubject(actor);
  return withDenialAudit(() =>
    db.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({ where: { id } });
      if (!inv || !invoicePolicy.submit(subject, inv)) throw denial(actor, "invoice.submit", id, inv?.branchId);
      await submitWithin(tx, actor, id);
    }),
  );
}

// ───────────────────────── Vendor: supply records ─────────────────────────

export async function saveSupplyRecord(actor: Actor, input: SupplyInput) {
  const v = supplySchema.parse(input);
  const subject = await loadSubject(actor);
  calculateLine({ quantity: v.quantity, unitPrice: v.unitPrice, taxRate: v.taxRate, discount: v.discount }); // validates discount ≤ line
  return withDenialAudit(() =>
    db.$transaction(async (tx) => {
      if (!subject.vendorId || !(subject.vendorBranchIds ?? []).includes(v.branchId)) {
        throw new AccessDenied({ actorId: actor.userId, actorRole: actor.role, action: "supply.branch_violation", entityType: "supply", entityId: v.branchId, branchId: v.branchId });
      }
      const rec = await tx.vendorSupplyRecord.create({
        data: {
          vendorId: subject.vendorId,
          branchId: v.branchId,
          supplyDate: day(v.supplyDate),
          itemName: v.itemName,
          description: v.description || null,
          quantity: dec(v.quantity).toFixed(4),
          unit: v.unit,
          unitPrice: dec(v.unitPrice).toFixed(4),
          taxRate: dec(v.taxRate).toFixed(4),
          discount: dec(v.discount).toFixed(2),
          notes: v.notes || null,
        },
      });
      await tx.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: "supply.recorded", entityType: "supply", entityId: rec.id, branchId: v.branchId } });
      return rec;
    }),
  );
}

// ───────────────────────── Admin: review ─────────────────────────

const REVIEW_ACTION = { APPROVED: "invoice.approved", REJECTED: "invoice.rejected", REVISION_REQUESTED: "invoice.revision_requested" } as const;
const REVIEW_NOTIFY = { APPROVED: "invoice_approved", REJECTED: "invoice_rejected", REVISION_REQUESTED: "invoice_revisionRequested" } as const;

export async function reviewInvoice(actor: Actor, input: { id: string; decision: "APPROVED" | "REJECTED" | "REVISION_REQUESTED"; note?: string }) {
  if (actor.role !== "SUPER_ADMIN") throw new DomainError("notAllowed");
  if (input.decision !== "APPROVED" && !input.note?.trim()) throw new DomainError("noteRequired");
  return db.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id: input.id }, include: { vendor: { select: { userId: true } } } });
    if (!inv) throw new DomainError("notFound");
    const res = await tx.invoice.updateMany({
      where: { id: inv.id, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      data: { status: input.decision, reviewNote: input.note || null, approvedAt: input.decision === "APPROVED" ? new Date() : null, version: { increment: 1 } },
    });
    if (res.count !== 1) throw new DomainError("alreadyProcessed");
    await tx.invoiceStatusHistory.create({ data: { invoiceId: inv.id, fromStatus: inv.status, toStatus: input.decision, actorId: actor.userId, note: input.note || null } });
    await tx.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: REVIEW_ACTION[input.decision], entityType: "invoice", entityId: inv.id, branchId: inv.branchId, summary: { number: inv.number, grandTotal: inv.grandTotal.toString() } } });
    await notifyUsers([inv.vendor.userId], { type: REVIEW_NOTIFY[input.decision], params: { number: inv.number }, emailDetails: { total: `${inv.currency} ${inv.grandTotal}`, status: input.decision, reason: input.note || "" }, entityType: "invoice", entityId: inv.id, href: `/vendor/invoices/${inv.id}` }, tx);
  });
}

export async function markInvoiceUnderReview(actor: Actor, id: string) {
  if (actor.role !== "SUPER_ADMIN") return;
  await db.$transaction(async (tx) => {
    const res = await tx.invoice.updateMany({ where: { id, status: "SUBMITTED" }, data: { status: "UNDER_REVIEW" } });
    if (res.count === 1) await tx.invoiceStatusHistory.create({ data: { invoiceId: id, fromStatus: "SUBMITTED", toStatus: "UNDER_REVIEW", actorId: actor.userId } });
  });
}

// ───────────────────────── Admin: payments ─────────────────────────

async function lockInvoice(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${id}::uuid FOR UPDATE`;
  const inv = await tx.invoice.findUnique({ where: { id }, include: { payments: { select: { amount: true } }, vendor: { select: { userId: true } } } });
  if (!inv) throw new DomainError("notFound");
  return inv;
}

async function applyPaidTotal(tx: Tx, actor: Actor, inv: Awaited<ReturnType<typeof lockInvoice>>, entries: string[]) {
  const outstanding = outstandingBalance(inv.grandTotal.toString(), entries);
  const paid = dec(inv.grandTotal.toString()).minus(outstanding);
  const status = outstanding.lte(0) ? "PAID" : paid.gt(0) ? "PARTIALLY_PAID" : "APPROVED";
  await tx.invoice.update({ where: { id: inv.id }, data: { amountPaid: toFixedString(paid, inv.currency), status, version: { increment: 1 } } });
  if (status !== inv.status) await tx.invoiceStatusHistory.create({ data: { invoiceId: inv.id, fromStatus: inv.status, toStatus: status, actorId: actor.userId } });
  return status;
}

/** Idempotent: replaying the same idempotencyKey returns the original payment. */
export async function recordPayment(
  actor: Actor,
  input: { invoiceId: string; amount: string; paymentDate: string; method?: string; reference?: string; notes?: string; proofKey?: string | null; idempotencyKey: string },
) {
  if (actor.role !== "SUPER_ADMIN") throw new DomainError("notAllowed");
  const existing = await db.invoicePayment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return existing;
  return db.$transaction(async (tx) => {
    const inv = await lockInvoice(tx, input.invoiceId);
    if (!invoicePolicy.recordPayment({ userId: actor.userId, role: actor.role }, inv)) throw new DomainError("notPayable");
    const entries = inv.payments.map((p) => p.amount.toString());
    try {
      assertPaymentAllowed(inv.grandTotal.toString(), entries, input.amount);
    } catch {
      throw new DomainError("overpayment");
    }
    const amount = toFixedString(input.amount, inv.currency);
    const payment = await tx.invoicePayment.create({
      data: {
        invoiceId: inv.id,
        amount,
        paymentDate: day(input.paymentDate),
        method: input.method || null,
        reference: input.reference || null,
        notes: input.notes || null,
        proofKey: input.proofKey ?? null,
        idempotencyKey: input.idempotencyKey,
        recordedById: actor.userId,
      },
    });
    const status = await applyPaidTotal(tx, actor, inv, [...entries, amount]);
    await tx.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: "payment.recorded", entityType: "invoice", entityId: inv.id, branchId: inv.branchId, summary: { number: inv.number, amount, currency: inv.currency, reference: input.reference || null } } });
    await notifyUsers([inv.vendor.userId], { type: "invoice_paymentRecorded", params: { number: inv.number }, emailDetails: { amount: `${inv.currency} ${amount}`, date: input.paymentDate, balance: `${inv.currency} ${outstandingBalance(inv.grandTotal.toString(), [...entries, amount])}`, status }, entityType: "invoice", entityId: inv.id, href: `/vendor/invoices/${inv.id}` }, tx);
    return payment;
  });
}

/** Payments are immutable. A correction is a compensating (negative) entry that reverses one payment. */
export async function correctPayment(actor: Actor, input: { paymentId: string; reason: string; idempotencyKey: string }) {
  if (actor.role !== "SUPER_ADMIN") throw new DomainError("notAllowed");
  if (!input.reason.trim()) throw new DomainError("noteRequired");
  const existing = await db.invoicePayment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return existing;
  return db.$transaction(async (tx) => {
    const original = await tx.invoicePayment.findUnique({ where: { id: input.paymentId }, include: { correctedBy: true } });
    if (!original || original.entryType !== "PAYMENT") throw new DomainError("notFound");
    if (original.correctedBy.length > 0) throw new DomainError("alreadyProcessed");
    const inv = await lockInvoice(tx, original.invoiceId);
    const reversal = dec(original.amount.toString()).negated().toFixed(2);
    const entry = await tx.invoicePayment.create({
      data: {
        invoiceId: inv.id,
        entryType: "CORRECTION",
        amount: reversal,
        paymentDate: new Date(new Date().toISOString().slice(0, 10)),
        notes: input.reason,
        correctsId: original.id,
        idempotencyKey: input.idempotencyKey,
        recordedById: actor.userId,
      },
    });
    await applyPaidTotal(tx, actor, inv, [...inv.payments.map((p) => p.amount.toString()), reversal]);
    await notifyUsers([inv.vendor.userId], { type: "invoice_paymentCorrected", params: { number: inv.number }, entityType: "invoice", entityId: inv.id, href: `/vendor/invoices/${inv.id}` }, tx);
    await tx.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: "payment.corrected", entityType: "invoice", entityId: inv.id, branchId: inv.branchId, summary: { number: inv.number, reversed: original.amount.toString(), reason: input.reason } } });
    return entry;
  });
}

// ───────────────────────── Reconciliation (no double counting) ─────────────────────────

export async function linkExpenseToInvoice(actor: Actor, input: { expenseId: string; invoiceId: string; type: "DUPLICATE_OF" | "RELATED"; note?: string }) {
  if (actor.role !== "SUPER_ADMIN") throw new DomainError("notAllowed");
  return db.$transaction(async (tx) => {
    const [e, i] = await Promise.all([tx.expense.findUnique({ where: { id: input.expenseId } }), tx.invoice.findUnique({ where: { id: input.invoiceId } })]);
    if (!e || !i || e.status === "DRAFT" || i.status === "DRAFT") throw new DomainError("notFound");
    const dup = await tx.financialReconciliation.findFirst({ where: { expenseId: e.id, invoiceId: i.id, unlinkedAt: null } });
    if (dup) throw new DomainError("alreadyLinked");
    const r = await tx.financialReconciliation.create({ data: { expenseId: e.id, invoiceId: i.id, type: input.type, note: input.note || null, linkedById: actor.userId } });
    await tx.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: "reconciliation.linked", entityType: "expense", entityId: e.id, branchId: e.branchId, summary: { invoice: i.number, expense: e.number, type: input.type } } });
    return r;
  });
}

export async function unlinkReconciliation(actor: Actor, id: string) {
  if (actor.role !== "SUPER_ADMIN") throw new DomainError("notAllowed");
  return db.$transaction(async (tx) => {
    const r = await tx.financialReconciliation.updateMany({ where: { id, unlinkedAt: null }, data: { unlinkedAt: new Date() } });
    if (r.count !== 1) throw new DomainError("alreadyProcessed");
    await tx.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: "reconciliation.unlinked", entityType: "reconciliation", entityId: id } });
  });
}
