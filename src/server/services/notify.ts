import "server-only";
import { db, type Tx } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { queueEmails } from "@/server/email/service";
import { isEmailEvent } from "@/server/email/templates";

/**
 * Database-backed, role-scoped notifications. `type` is a translation key in
 * the "notify" messages; `params` must only contain data the RECIPIENT is
 * allowed to see (record numbers/titles of their own or administered records).
 */
export interface NotifyInput {
  type: string;
  params?: Record<string, string | number>;
  entityType?: string;
  entityId?: string;
  href?: string;
  emailDetails?: Record<string, string>;
}

function preferenceFor(type: string): "notifyExpenseUpdates" | "notifyInvoiceUpdates" | "notifyAccountUpdates" {
  if (type.startsWith("expense_")) return "notifyExpenseUpdates";
  if (type.startsWith("invoice_")) return "notifyInvoiceUpdates";
  return "notifyAccountUpdates";
}

/** Delivers only to recipients who have not opted out of this notification category. */
export async function notifyUsers(userIds: string[], n: NotifyInput, tx?: Tx): Promise<void> {
  if (!tx) return db.$transaction(client => notifyUsers(userIds, n, client));
  if (userIds.length === 0) return;
  const client = tx ?? db;
  if (isEmailEvent(n.type)) {
      await queueEmails(client, userIds, { event: n.type, entityType: n.entityType, entityId: n.entityId, path: n.href,
        details: { ...Object.fromEntries(Object.entries(n.params ?? {}).map(([k,v]) => [k, String(v)])), ...n.emailDetails } });
  }
  const pref = preferenceFor(n.type);
  const optedOut = new Set(
    (await client.userPreference.findMany({ where: { userId: { in: userIds }, [pref]: false }, select: { userId: true } })).map((p) => p.userId),
  );
  const recipients = [...new Set(userIds)].filter((id) => !optedOut.has(id));
  if (recipients.length === 0) return;
  await client.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: n.type,
      params: (n.params ?? undefined) as Prisma.InputJsonValue | undefined,
      entityType: n.entityType ?? null,
      entityId: n.entityId ?? null,
      href: n.href ?? null,
    })),
  });
}

export async function notifyAdmins(n: NotifyInput, tx?: Tx): Promise<void> {
  const client = tx ?? db;
  const admins = await client.user.findMany({ where: { role: "SUPER_ADMIN", status: "ACTIVE" }, select: { id: true } });
  await notifyUsers(
    admins.map((a) => a.id),
    n,
    tx,
  );
}
