import "server-only";
import { randomUUID } from "node:crypto";
import type { Tx } from "@/server/db";
import { encryptPayload } from "./crypto";
import { publicUrl, safeAddress } from "./config";
import { type EmailEvent, type EmailPayload } from "./templates";

export function emailPreference(event: string) {
  if (["verification", "password_reset", "password_changed", "account_approved", "account_rejected", "account_suspended", "account_reactivated", "account_infoRequested", "registration_received", "vendor_registration_received"].includes(event)) return null;
  if (event.startsWith("expense_")) return "emailExpenseUpdates" as const;
  if (event.startsWith("invoice_")) return "emailInvoiceUpdates" as const;
  if (event.includes("branch")) return "emailBranchUpdates" as const;
  return "emailActivityUpdates" as const;
}

type EmailInput = { event: EmailEvent; key?: string; entityType?: string; entityId?: string; authTokenId?: string; path?: string; details?: Record<string,string> };
export async function queueEmails(tx: Tx, userIds: string[], input: EmailInput) {
  const users = await tx.user.findMany({ where: { id: { in: [...new Set(userIds)] } }, include: { preferences: true, vendorProfile: { select: { businessName: true } } } });
  const pref = emailPreference(input.event);
  const eventKey = input.key ?? `${input.event}:${randomUUID()}`;
  const data = users.filter(user => !pref || (user.status === "ACTIVE" && user.preferences?.[pref] !== false)).map(user => {
  const path = input.path ?? (user.role === "SUPER_ADMIN" ? "/admin/dashboard" : user.role === "VENDOR" ? "/vendor/dashboard" : "/user/dashboard");
  publicUrl(path);
  const payload: EmailPayload = { name: user.fullName, path, details: { ...(user.vendorProfile ? { vendor: user.vendorProfile.businessName } : {}), ...(input.event === "account_approved" ? { role: user.role ?? "", status: user.status } : {}), ...input.details } };
  // createMany(skipDuplicates) avoids poisoning the surrounding transaction on replay.
  const id = randomUUID();
  return {
    id, idempotencyKey: `${eventKey}:${user.id}`, eventType: input.event, template: input.event,
    userId: user.id, recipient: safeAddress(user.email), language: user.preferences?.locale ?? "en",
    entityType: input.entityType, entityId: input.entityId, authTokenId: input.authTokenId,
    payload: encryptPayload(payload),
  };
  });
  if (!data.length) return [];
  await tx.emailOutbox.createMany({ skipDuplicates: true, data });
  const inserted = await tx.emailOutbox.findMany({ where: { id: { in: data.map(d => d.id) } }, select: { id: true } });
  if (inserted.length) await tx.auditLog.createMany({ data: inserted.map(({id}) => ({ action: "email.queued", entityType: "email", entityId: id, summary: { event: input.event } })) });
  return inserted.map(j => j.id);
}
export async function queueEmail(tx: Tx, input: EmailInput & { userId: string }) {
  return (await queueEmails(tx, [input.userId], input))[0] ?? null;
}
