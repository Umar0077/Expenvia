import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import type { Actor } from "@/server/auth/session";
import type { Subject } from "./policy";

/** Loads the facts the policy layer needs about the current actor (once per request). */
export const loadSubject = cache(async (actor: Actor): Promise<Subject> => {
  if (actor.role === "USER") {
    const a = await db.userBranchAssignment.findFirst({
      where: { userId: actor.userId, endedAt: null },
      select: { branchId: true },
    });
    return { userId: actor.userId, role: actor.role, activeBranchId: a?.branchId ?? null };
  }
  if (actor.role === "VENDOR") {
    const v = await db.vendorProfile.findUnique({
      where: { userId: actor.userId },
      select: { id: true, branchAssignments: { where: { removedAt: null, branch: { status: "ACTIVE" } }, select: { branchId: true } } },
    });
    return {
      userId: actor.userId,
      role: actor.role,
      vendorId: v?.id ?? null,
      vendorBranchIds: v?.branchAssignments.map((b) => b.branchId) ?? [],
    };
  }
  return { userId: actor.userId, role: actor.role };
});
