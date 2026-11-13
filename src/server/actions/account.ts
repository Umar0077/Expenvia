"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { rateLimit } from "@/server/auth/rate-limit";
import { DomainError } from "@/server/errors";
import { runAction } from "./result";
import { queueEmail } from "@/server/email/service";

const strong = z.string().min(10, "passwordWeak").max(200, "tooLong").regex(/[A-Za-z؀-ۿ]/, "passwordWeak").regex(/\d/, "passwordWeak");

export async function markNotificationsReadAction(input: unknown) {
  const actor = await requireActor();
  return runAction(z.object({ ids: z.array(z.string().uuid()).max(200).optional() }), input, async ({ ids }) => {
    // Scoped to the current user: other users' notifications can never be touched.
    await db.notification.updateMany({ where: { userId: actor.userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
    revalidatePath("/", "layout");
  });
}

export async function updateProfileAction(input: unknown) {
  const actor = await requireActor();
  return runAction(
    z.object({
      fullName: z.string().trim().min(2, "nameShort").max(120, "tooLong"),
      phone: z.string().trim().max(24, "tooLong").refine((v) => v === "" || /^\+?[\d\s()-]{7,20}$/.test(v), "phoneInvalid"),
    }),
    input,
    async (d) => {
      await db.$transaction([
        db.user.update({ where: { id: actor.userId }, data: { fullName: d.fullName, phone: d.phone || null } }),
        db.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: "account.profile_updated", entityType: "user", entityId: actor.userId } }),
      ]);
      revalidatePath("/", "layout");
    },
  );
}

export async function updateNotificationPrefsAction(input: unknown) {
  const actor = await requireActor();
  return runAction(
    z.object({ key: z.enum(["notifyExpenseUpdates", "notifyInvoiceUpdates", "notifyAccountUpdates", "emailExpenseUpdates", "emailInvoiceUpdates", "emailBranchUpdates", "emailActivityUpdates"]), value: z.boolean() }),
    input,
    async ({ key, value }) => {
      await db.userPreference.upsert({ where: { userId: actor.userId }, create: { userId: actor.userId, [key]: value }, update: { [key]: value } });
    },
  );
}

export async function changePasswordAction(input: unknown) {
  const actor = await requireActor();
  return runAction(
    z.object({ current: z.string().min(1, "required").max(200), next: strong, confirm: z.string() }).refine((v) => v.next === v.confirm, { path: ["confirm"], message: "passwordMismatch" }),
    input,
    async (d) => {
      if (!(await rateLimit(`pwchange:${actor.userId}`, 5, 900))) throw new DomainError("rateLimited");
      const user = await db.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { passwordHash: true } });
      if (!(await verifyPassword(user.passwordHash, d.current))) {
        await db.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: "auth.password_change", outcome: "FAILURE", entityType: "user", entityId: actor.userId } });
        throw new DomainError("wrongPassword");
      }
      const passwordHash = await hashPassword(d.next);
      await db.$transaction(async tx => {
        await tx.user.update({ where: { id: actor.userId }, data: { passwordHash } });
        // Keep this device signed in; revoke every other session.
        await tx.session.updateMany({ where: { userId: actor.userId, revokedAt: null, NOT: { id: actor.sessionId } }, data: { revokedAt: new Date() } });
        await tx.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: "auth.password_changed", entityType: "user", entityId: actor.userId } });
        await queueEmail(tx, { userId: actor.userId, event: "password_changed", path: "/login" });
      });
    },
  );
}

export async function signOutOtherSessionsAction() {
  const actor = await requireActor();
  return runAction(z.object({}), {}, async () => {
    const r = await db.session.updateMany({ where: { userId: actor.userId, revokedAt: null, NOT: { id: actor.sessionId } }, data: { revokedAt: new Date() } });
    await db.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: "auth.sessions_revoked", entityType: "user", entityId: actor.userId, summary: { count: r.count, self: true } } });
    revalidatePath("/", "layout");
  });
}

export async function saveSystemSettingsAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(z.object({ orgName: z.string().trim().min(2, "required").max(120, "tooLong") }), input, async (d) => {
    const before = await db.systemSetting.findUnique({ where: { key: "orgName" } });
    await db.$transaction([
      db.systemSetting.upsert({ where: { key: "orgName" }, create: { key: "orgName", value: d.orgName, updatedById: actor.userId }, update: { value: d.orgName, updatedById: actor.userId } }),
      db.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: "settings.changed", entityType: "system_setting", entityId: "orgName", summary: { orgName: { from: before?.value ?? null, to: d.orgName } } } }),
    ]);
    revalidatePath("/admin/settings");
  });
}
