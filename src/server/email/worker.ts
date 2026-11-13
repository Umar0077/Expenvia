import "server-only";
import { randomUUID } from "node:crypto";
import { db, type Tx } from "@/server/db";
import type { EmailOutbox } from "@/generated/prisma/client";
import { decryptPayload } from "./crypto";
import { emailPreference } from "./service";
import { isEmailEvent, payloadSchema, renderEmail } from "./templates";
import { classifyError, type EmailProvider } from "./provider";

export const retryDelay = (attempt: number) => Math.min(3600_000, 30_000 * 2 ** Math.min(attempt - 1, 10));

export async function claimEmail(): Promise<{ id: string; claimId: string } | null> {
  const claimId = randomUUID();
  const result = await db.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM email_outbox WHERE
      (status IN ('PENDING', 'RETRY_SCHEDULED') AND next_attempt_at <= now())
      OR (status = 'PROCESSING' AND locked_until < now())
      ORDER BY next_attempt_at, created_at FOR UPDATE SKIP LOCKED LIMIT 1`;
    const row = rows[0];
    if (!row) return null;
    const job = await tx.emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
    if (job.attempts >= job.maxAttempts) {
      await tx.emailOutbox.update({ where: { id: job.id }, data: { status: "FAILED", errorCategory: "ATTEMPTS_EXHAUSTED", lockedUntil: null, claimId: null } });
      await tx.auditLog.create({ data: { action: "email.delivery_failed", outcome: "FAILURE", entityType: "email", entityId: job.id, summary: { category: "ATTEMPTS_EXHAUSTED" } } });
      return "exhausted" as const;
    }
    await tx.emailOutbox.update({ where: { id: row.id }, data: { status: "PROCESSING", claimId, lockedUntil: new Date(Date.now() + 120_000), lastAttemptAt: new Date(), attempts: { increment: 1 } } });
    return { id: row.id, claimId };
  });
  return result === "exhausted" ? claimEmail() : result;
}

async function eligible(tx: Tx, job: EmailOutbox): Promise<boolean> {
  const user = await tx.user.findUnique({ where: { id: job.userId }, include: { preferences: true } });
  if (!user || user.email !== job.recipient) return false;
  const preference = emailPreference(job.eventType);
  if (preference && (user.status !== "ACTIVE" || user.preferences?.[preference] === false)) return false;
  if (job.authTokenId) {
    const token = await tx.authToken.findUnique({ where: { id: job.authTokenId } });
    if (!token || token.usedAt || token.expiresAt <= new Date() || token.userId !== user.id) return false;
  }
  // Recheck access at delivery, including admin demotion or changed record ownership.
  if (["expense_submitted", "invoice_submitted", "registration_pending"].includes(job.eventType)) return user.role === "SUPER_ADMIN" && user.status === "ACTIVE";
  if (job.entityType === "expense" && job.entityId) return !!(await tx.expense.findFirst({ where: { id: job.entityId, ownerId: user.id } }));
  if (job.entityType === "invoice" && job.entityId) return !!(await tx.invoice.findFirst({ where: { id: job.entityId, vendor: { userId: user.id } } }));
  return true;
}

export async function processEmail(claim: { id: string; claimId: string }, provider: EmailProvider): Promise<void> {
  // Hold the row lock through the bounded provider call. Recovery also uses SKIP LOCKED,
  // so it cannot start a concurrent send even if a lease expires during a slow transport.
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM email_outbox WHERE id = ${claim.id}::uuid FOR UPDATE`;
    const job = await tx.emailOutbox.findUniqueOrThrow({ where: { id: claim.id } });
    if (job.status !== "PROCESSING" || job.claimId !== claim.claimId) return;
    if (!job.payload || !isEmailEvent(job.eventType) || !(await eligible(tx, job))) {
      await tx.emailOutbox.update({ where: { id: job.id }, data: { status: "CANCELLED", payload: null, completedAt: new Date(), claimId: null, lockedUntil: null, errorCategory: "NO_LONGER_ELIGIBLE" } });
      return;
    }
    let content;
    try { content = renderEmail(job.eventType, job.language, payloadSchema.parse(decryptPayload(job.payload))); }
    catch {
      await tx.emailOutbox.update({ where: { id: job.id }, data: { status: "FAILED", errorCategory: "PAYLOAD_OR_CONFIGURATION", lockedUntil: null, claimId: null } });
      await tx.auditLog.create({ data: { action: "email.delivery_failed", outcome: "FAILURE", entityType: "email", entityId: job.id, summary: { category: "PAYLOAD_OR_CONFIGURATION" } } });
      return;
    }
    try {
      const result = await provider.send({ id: job.id, to: job.recipient, ...content });
      await tx.emailOutbox.update({ where: { id: job.id }, data: { status: result.preview ? "PREVIEWED" : "SENT", provider: provider.name, providerReference: result.reference.slice(0, 300), sentAt: result.preview ? null : new Date(), completedAt: new Date(), payload: null, errorCategory: null, claimId: null, lockedUntil: null } });
    } catch (error) {
      const failure = classifyError(error), retry = failure.temporary && job.attempts < job.maxAttempts;
      await tx.emailOutbox.update({ where: { id: job.id }, data: { status: retry ? "RETRY_SCHEDULED" : "FAILED", provider: provider.name, errorCategory: failure.category, nextAttemptAt: new Date(Date.now() + retryDelay(job.attempts)), claimId: null, lockedUntil: null } });
      if (!retry) await tx.auditLog.create({ data: { action: "email.delivery_failed", outcome: "FAILURE", entityType: "email", entityId: job.id, summary: { category: failure.category, attempts: job.attempts } } });
    }
  }, { timeout: 90_000, maxWait: 10_000 });
}

export async function retryEmail(tx: Tx, id: string, actorId: string) {
  const result = await tx.emailOutbox.updateMany({ where: { id, status: "FAILED", manualRetries: { lt: 2 }, payload: { not: null }, authTokenId: null }, data: { status: "PENDING", manualRetries: { increment: 1 }, maxAttempts: { increment: 5 }, nextAttemptAt: new Date(), errorCategory: null } });
  if (result.count) await tx.auditLog.create({ data: { actorId, actorRole: "SUPER_ADMIN", action: "email.admin_retry", entityType: "email", entityId: id } });
  return result.count === 1;
}
