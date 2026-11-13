"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { createSession, dashboardFor } from "@/server/auth/session";
import { devAccessEnabled } from "@/server/dev-access";
import type { FormResult } from "./auth";

const schema = z.object({
  fullName: z.string().trim().min(2, "nameShort").max(120, "tooLong"),
  email: z.string().trim().toLowerCase().email("emailInvalid").max(254, "tooLong"),
  password: z.string().min(6, "passwordWeak").max(200, "tooLong"),
  role: z.enum(["SUPER_ADMIN", "USER", "VENDOR"]),
});

/**
 * DEV ONLY: creates an already-approved account with the chosen role and signs in.
 * Employees get the first active branch; vendors are assigned to every active branch.
 */
export async function devQuickAccessAction(input: unknown): Promise<FormResult> {
  if (!devAccessEnabled()) return { ok: false, error: "genericError" };
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { ok: false, fields };
  }
  const v = parsed.data;
  if (await db.user.findUnique({ where: { email: v.email }, select: { id: true } })) return { ok: false, error: "emailTaken" };

  const passwordHash = await hashPassword(v.password);
  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { email: v.email, fullName: v.fullName, passwordHash, role: v.role, status: "ACTIVE", emailVerifiedAt: new Date(), preferences: { create: {} } },
    });
    const actorId = (await tx.user.findFirst({ where: { role: "SUPER_ADMIN", NOT: { id: u.id } }, select: { id: true } }))?.id ?? u.id;
    const branches = await tx.branch.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { id: true } });

    if (v.role === "USER" && branches[0]) {
      await tx.userBranchAssignment.create({ data: { userId: u.id, branchId: branches[0].id, assignedById: actorId } });
    }
    if (v.role === "VENDOR") {
      await tx.vendorProfile.create({
        data: {
          userId: u.id,
          businessName: `${v.fullName} Supplies (dev)`,
          contactPerson: v.fullName,
          businessEmail: v.email,
          branchAssignments: { create: branches.map((b) => ({ branchId: b.id, assignedById: actorId })) },
        },
      });
    }
    await tx.auditLog.create({
      data: { actorId: u.id, actorRole: v.role, action: "dev.quick_access_account_created", entityType: "user", entityId: u.id, summary: { role: v.role, devOnly: true } },
    });
    return u;
  });

  await createSession(user.id);
  redirect(dashboardFor(v.role));
}
