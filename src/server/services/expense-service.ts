import "server-only";
import { db, type Tx } from "@/server/db";
import type { Actor } from "@/server/auth/session";
import type { ExpenseStatus } from "@/generated/prisma/enums";
import { AccessDenied, DomainError } from "@/server/errors";
import { withDenialAudit } from "@/server/denial";
import { expensePolicy } from "@/server/authz/policy";
import { loadSubject } from "@/server/authz/subject";
import { expenseSchema, type ExpenseInput } from "@/lib/validation/expense";
import { toFixedString } from "@/lib/finance/money";
import type { StoredFile } from "@/server/storage";
import { notifyAdmins, notifyUsers } from "./notify";

export const MAX_ATTACHMENTS = 5;

async function nextExpenseNumber(tx: Tx): Promise<string> {
  const [row] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('expense_number_seq') AS n`;
  return `EXP-EXP-${new Date().getUTCFullYear()}-${String(row!.n).padStart(6, "0")}`;
}

function toData(input: ExpenseInput) {
  const v = expenseSchema.parse(input);
  return {
    categoryId: v.categoryId,
    title: v.title,
    description: v.description || null,
    amount: toFixedString(v.amount, v.currency),
    currency: v.currency,
    expenseDate: new Date(`${v.expenseDate}T00:00:00Z`),
    payeeName: v.payeeName || null,
    paymentMethod: v.paymentMethod || null,
    referenceNumber: v.referenceNumber || null,
  };
}

async function assertCategoryActive(tx: Tx, categoryId: string) {
  const c = await tx.expenseCategory.findUnique({ where: { id: categoryId }, select: { isActive: true } });
  if (!c?.isActive) throw new DomainError("categoryInactive");
}

/** Loads an expense and throws `notAllowed` unless the policy permits `check`. Never reveals existence. */
async function loadForActor(tx: Tx, actor: Actor, id: string, check: "view" | "edit" | "submit") {
  const e = await tx.expense.findUnique({ where: { id } });
  const subject = await loadSubject(actor);
  if (!e || !expensePolicy[check](subject, e)) {
    throw new AccessDenied({ actorId: actor.userId, actorRole: actor.role, action: `expense.${check}`, entityType: "expense", entityId: id, branchId: e?.branchId });
  }
  return e;
}

export async function saveExpense(actor: Actor, input: { id?: string | null; data: ExpenseInput; version?: number; submit: boolean; files?: StoredFile[] }) {
  const data = toData(input.data);
  const subject = await loadSubject(actor);
  return withDenialAudit(() => db.$transaction(async (tx) => {
    await assertCategoryActive(tx, data.categoryId);
    let expense;
    if (!input.id) {
      const branchId = subject.activeBranchId;
      if (!branchId || !expensePolicy.create(subject, branchId)) throw new DomainError("noBranch");
      const branch = await tx.branch.findUnique({ where: { id: branchId }, select: { status: true } });
      if (branch?.status !== "ACTIVE") throw new DomainError("branchInactive");
      expense = await tx.expense.create({ data: { ...data, number: await nextExpenseNumber(tx), ownerId: actor.userId, branchId } });
      await tx.expenseStatusHistory.create({ data: { expenseId: expense.id, toStatus: "DRAFT", actorId: actor.userId } });
      await tx.auditLog.create({
        data: { actorId: actor.userId, actorRole: actor.role, action: "expense.created", entityType: "expense", entityId: expense.id, branchId, summary: { number: expense.number, amount: data.amount, currency: data.currency } },
      });
    } else {
      const existing = await loadForActor(tx, actor, input.id, "edit");
      // Optimistic concurrency: reject if the record changed since the form loaded.
      const res = await tx.expense.updateMany({
        where: { id: existing.id, version: input.version ?? existing.version, status: { in: ["DRAFT", "REVISION_REQUESTED"] } },
        data: { ...data, version: { increment: 1 } },
      });
      if (res.count !== 1) throw new DomainError("staleRecord");
      expense = await tx.expense.findUniqueOrThrow({ where: { id: existing.id } });
      await tx.auditLog.create({
        data: { actorId: actor.userId, actorRole: actor.role, action: existing.status === "REVISION_REQUESTED" ? "expense.revised" : "expense.updated", entityType: "expense", entityId: expense.id, branchId: expense.branchId },
      });
    }

    if (input.files?.length) {
      const count = await tx.expenseAttachment.count({ where: { expenseId: expense.id } });
      if (count + input.files.length > MAX_ATTACHMENTS) throw new DomainError("tooManyFiles");
      await tx.expenseAttachment.createMany({ data: input.files.map((f) => ({ ...f, expenseId: expense.id })) });
    }

    if (input.submit) await submitWithin(tx, actor, expense.id, expense.status);
    return tx.expense.findUniqueOrThrow({ where: { id: expense.id } });
  }));
}

async function submitWithin(tx: Tx, actor: Actor, id: string, from: ExpenseStatus) {
  const res = await tx.expense.updateMany({
    where: { id, ownerId: actor.userId, status: { in: ["DRAFT", "REVISION_REQUESTED"] } },
    data: { status: "SUBMITTED", submittedAt: new Date(), version: { increment: 1 } },
  });
  if (res.count !== 1) throw new DomainError("staleRecord");
  const e = await tx.expense.findUniqueOrThrow({ where: { id }, include: { owner: { select: { fullName: true } }, branch: { select: { name: true } } } });
  await tx.expenseStatusHistory.create({ data: { expenseId: id, fromStatus: from, toStatus: "SUBMITTED", actorId: actor.userId } });
  await tx.auditLog.create({
    data: { actorId: actor.userId, actorRole: actor.role, action: "expense.submitted", entityType: "expense", entityId: id, branchId: e.branchId, summary: { number: e.number, amount: e.amount.toString(), currency: e.currency } },
  });
  await notifyAdmins({ type: "expense_submitted", params: { name: e.owner.fullName, number: e.number }, emailDetails: { branch: e.branch.name, amount: `${e.currency} ${e.amount}`, submittedAt: e.submittedAt!.toISOString().slice(0,10), status: e.status }, entityType: "expense", entityId: id, href: `/admin/approvals?id=${id}` }, tx);
}

export async function submitExpense(actor: Actor, id: string) {
  return withDenialAudit(() => db.$transaction(async (tx) => {
    const e = await loadForActor(tx, actor, id, "submit");
    await submitWithin(tx, actor, id, e.status);
  }));
}

export async function removeAttachment(actor: Actor, attachmentId: string) {
  return withDenialAudit(() => db.$transaction(async (tx) => {
    const a = await tx.expenseAttachment.findUnique({ where: { id: attachmentId } });
    if (!a) throw new DomainError("notFound");
    await loadForActor(tx, actor, a.expenseId, "edit");
    await tx.expenseAttachment.delete({ where: { id: attachmentId } });
    await tx.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: "expense.attachment_removed", entityType: "expense", entityId: a.expenseId, summary: { fileName: a.fileName } } });
  }));
}

const DECISION_ACTION = { APPROVED: "expense.approved", REJECTED: "expense.rejected", REVISION_REQUESTED: "expense.revision_requested" } as const;
const DECISION_NOTIFY = { APPROVED: "expense_approved", REJECTED: "expense_rejected", REVISION_REQUESTED: "expense_revisionRequested" } as const;

/**
 * Admin decision. The conditional UPDATE (status must still be reviewable)
 * makes concurrent/duplicate approvals impossible: only one wins.
 */
export async function reviewExpenses(actor: Actor, input: { ids: string[]; decision: "APPROVED" | "REJECTED" | "REVISION_REQUESTED"; note?: string }) {
  if (actor.role !== "SUPER_ADMIN") throw new DomainError("notAllowed");
  if (input.decision !== "APPROVED" && !input.note?.trim()) throw new DomainError("noteRequired");
  if (input.decision !== "APPROVED" && input.ids.length > 1) throw new DomainError("bulkApproveOnly");

  return db.$transaction(async (tx) => {
    let processed = 0;
    for (const id of input.ids) {
      const before = await tx.expense.findUnique({ where: { id }, select: { status: true, ownerId: true, number: true, branchId: true, amount: true, currency: true } });
      if (!before) continue;
      const res = await tx.expense.updateMany({
        where: { id, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
        data: { status: input.decision, reviewedById: actor.userId, reviewedAt: new Date(), reviewNote: input.note || null, version: { increment: 1 } },
      });
      if (res.count !== 1) continue;
      processed++;
      await tx.expenseStatusHistory.create({ data: { expenseId: id, fromStatus: before.status, toStatus: input.decision, actorId: actor.userId, note: input.note || null } });
      await tx.auditLog.create({
        data: { actorId: actor.userId, actorRole: actor.role, action: DECISION_ACTION[input.decision], entityType: "expense", entityId: id, branchId: before.branchId, summary: { number: before.number, amount: before.amount.toString(), currency: before.currency } },
      });
      await notifyUsers([before.ownerId], { type: DECISION_NOTIFY[input.decision], params: { number: before.number }, emailDetails: { amount: `${before.currency} ${before.amount}`, status: input.decision, reason: input.note || "" }, entityType: "expense", entityId: id, href: `/user/expenses/${id}` }, tx);
    }
    if (processed === 0) throw new DomainError("alreadyProcessed");
    return { processed, skipped: input.ids.length - processed };
  });
}

/** Marks a submitted expense as under review (admin opened it). Idempotent. */
export async function markUnderReview(actor: Actor, id: string) {
  if (actor.role !== "SUPER_ADMIN") return;
  await db.$transaction(async (tx) => {
    const res = await tx.expense.updateMany({ where: { id, status: "SUBMITTED" }, data: { status: "UNDER_REVIEW" } });
    if (res.count === 1) await tx.expenseStatusHistory.create({ data: { expenseId: id, fromStatus: "SUBMITTED", toStatus: "UNDER_REVIEW", actorId: actor.userId } });
  });
}
