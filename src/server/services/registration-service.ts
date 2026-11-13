import "server-only";
import { db } from "@/server/db";
import type { Actor } from "@/server/auth/session";
import { DomainError } from "@/server/errors";
import { notifyUsers } from "./notify";

const OPEN = ["PENDING", "INFO_REQUESTED"] as const;
const REVIEWABLE_USER_STATUS = ["PENDING_APPROVAL", "INFO_REQUESTED"] as const;

async function lockOpenRequest(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], id: string) {
  // Row lock prevents two admins processing the same request concurrently.
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM registration_requests WHERE id = ${id}::uuid FOR UPDATE`;
  if (rows.length === 0) throw new DomainError("notFound");
  const reg = await tx.registrationRequest.findUniqueOrThrow({ where: { id }, include: { user: true } });
  if (!(OPEN as readonly string[]).includes(reg.status)) throw new DomainError("alreadyProcessed");
  if (!(REVIEWABLE_USER_STATUS as readonly string[]).includes(reg.user.status)) throw new DomainError("notVerified");
  return reg;
}

export async function approveRegistration(actor: Actor, input: { id: string; branchIds: string[] }) {
  return db.$transaction(async (tx) => {
    const reg = await lockOpenRequest(tx, input.id);
    const branchIds = [...new Set(input.branchIds)];
    if (reg.requestedType === "USER" && branchIds.length > 1) throw new DomainError("oneBranchOnly");
    if (branchIds.length) {
      const active = await tx.branch.count({ where: { id: { in: branchIds }, status: "ACTIVE" } });
      if (active !== branchIds.length) throw new DomainError("branchInactive");
    }

    await tx.registrationRequest.update({ where: { id: reg.id }, data: { status: "APPROVED", reviewedById: actor.userId, reviewedAt: new Date() } });
    await tx.user.update({ where: { id: reg.userId }, data: { role: reg.requestedType, status: "ACTIVE" } });

    const branches = branchIds.length ? await tx.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } }) : [];

    if (reg.requestedType === "USER") {
      if (branchIds[0]) await tx.userBranchAssignment.create({ data: { userId: reg.userId, branchId: branchIds[0], assignedById: actor.userId } });
    } else {
      const vendor = await tx.vendorProfile.create({
        data: {
          userId: reg.userId,
          businessName: reg.businessName ?? reg.user.fullName,
          contactPerson: reg.user.fullName,
          businessEmail: reg.user.email,
          businessPhone: reg.user.phone,
          businessAddress: reg.businessAddress,
          businessCategory: reg.businessCategory,
          taxIdentifier: reg.taxIdentifier,
        },
      });
      if (branchIds.length) {
        await tx.vendorBranchAssignment.createMany({ data: branchIds.map((branchId) => ({ vendorId: vendor.id, branchId, assignedById: actor.userId })) });
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        actorRole: actor.role,
        action: "registration.approved",
        entityType: "user",
        entityId: reg.userId,
        branchId: branchIds[0] ?? null,
        summary: { requestedType: reg.requestedType, role: reg.requestedType, branches: branches.map((b) => b.name) },
      },
    });
    await notifyUsers([reg.userId], { type: "account_approved", entityType: "user", entityId: reg.userId }, tx);
    for (const b of branches) {
      await notifyUsers(
        [reg.userId],
        { type: reg.requestedType === "USER" ? "branch_assigned" : "vendor_branchAssigned", params: { branch: b.name }, entityType: "branch", entityId: b.id },
        tx,
      );
    }
    return { userId: reg.userId };
  });
}

export async function rejectRegistration(actor: Actor, input: { id: string; publicMessage?: string; internalNote?: string }) {
  return db.$transaction(async (tx) => {
    const reg = await lockOpenRequest(tx, input.id);
    await tx.registrationRequest.update({
      where: { id: reg.id },
      data: { status: "REJECTED", reviewedById: actor.userId, reviewedAt: new Date(), publicMessage: input.publicMessage || null, reviewNote: input.internalNote || null },
    });
    await tx.user.update({ where: { id: reg.userId }, data: { status: "REJECTED" } });
    await notifyUsers([reg.userId], { type: "account_rejected", href: "/registration-rejected", emailDetails: { reason: input.publicMessage || "" }, entityType: "user", entityId: reg.userId }, tx);
    await tx.session.updateMany({ where: { userId: reg.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({
      data: { actorId: actor.userId, actorRole: actor.role, action: "registration.rejected", entityType: "user", entityId: reg.userId, summary: { requestedType: reg.requestedType } },
    });
  });
}

export async function requestRegistrationInfo(actor: Actor, input: { id: string; publicMessage: string }) {
  return db.$transaction(async (tx) => {
    const reg = await lockOpenRequest(tx, input.id);
    await tx.registrationRequest.update({ where: { id: reg.id }, data: { status: "INFO_REQUESTED", publicMessage: input.publicMessage, reviewedById: actor.userId } });
    await tx.user.update({ where: { id: reg.userId }, data: { status: "INFO_REQUESTED" } });
    await tx.auditLog.create({
      data: { actorId: actor.userId, actorRole: actor.role, action: "registration.info_requested", entityType: "user", entityId: reg.userId },
    });
    await notifyUsers([reg.userId], { type: "account_infoRequested", entityType: "user", entityId: reg.userId }, tx);
  });
}
