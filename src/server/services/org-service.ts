import "server-only";
import { db, type Tx } from "@/server/db";
import type { Actor } from "@/server/auth/session";
import { DomainError } from "@/server/errors";
import { branchSchema, categorySchema, type BranchInput, type CategoryInput } from "@/lib/validation/org";
import { notifyUsers } from "./notify";

function auditData(actor: Actor, action: string, entityType: string, entityId: string, extra: { branchId?: string | null; summary?: object } = {}) {
  return {
    actorId: actor.userId,
    actorRole: actor.role,
    action,
    entityType,
    entityId,
    branchId: extra.branchId ?? null,
    summary: (extra.summary ?? undefined) as never,
  };
}

// ───────────────────────── Branches ─────────────────────────

export async function createBranch(actor: Actor, input: BranchInput) {
  const v = branchSchema.parse(input);
  return db.$transaction(async (tx) => {
    const b = await tx.branch.create({
      data: { ...v, address: v.address || null, contactEmail: v.contactEmail || null, contactPhone: v.contactPhone || null, managerName: v.managerName || null, createdById: actor.userId },
    });
    await tx.auditLog.create({ data: auditData(actor, "branch.created", "branch", b.id, { branchId: b.id, summary: { code: b.code, name: b.name } }) });
    return b;
  });
}

export async function updateBranch(actor: Actor, id: string, input: BranchInput) {
  const v = branchSchema.parse(input);
  return db.$transaction(async (tx) => {
    const before = await tx.branch.findUnique({ where: { id } });
    if (!before) throw new DomainError("notFound");
    const after = await tx.branch.update({
      where: { id },
      data: { ...v, address: v.address || null, contactEmail: v.contactEmail || null, contactPhone: v.contactPhone || null, managerName: v.managerName || null },
    });
    const changed = Object.fromEntries(
      (Object.keys(v) as (keyof typeof v)[])
        .filter((k) => (before[k] ?? "") !== (after[k] ?? ""))
        .map((k) => [k, { from: before[k], to: after[k] }]),
    );
    await tx.auditLog.create({ data: auditData(actor, "branch.updated", "branch", id, { branchId: id, summary: changed }) });
    return after;
  });
}

/** Deactivation keeps all history; it only blocks new records against the branch. */
export async function setBranchStatus(actor: Actor, id: string, status: "ACTIVE" | "INACTIVE") {
  return db.$transaction(async (tx) => {
    const b = await tx.branch.findUnique({ where: { id } });
    if (!b) throw new DomainError("notFound");
    if (b.status === status) return b;
    const updated = await tx.branch.update({ where: { id }, data: { status } });
    await tx.auditLog.create({ data: auditData(actor, status === "ACTIVE" ? "branch.activated" : "branch.deactivated", "branch", id, { branchId: id }) });
    return updated;
  });
}

// ───────────────────────── Employees ─────────────────────────

/** Ends the current assignment (history kept) and starts a new one. Past expenses keep their branch. */
export async function assignEmployeeBranch(actor: Actor, userId: string, branchId: string) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "USER") throw new DomainError("notFound");
    const branch = await tx.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new DomainError("notFound");
    if (branch.status !== "ACTIVE") throw new DomainError("branchInactive");

    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
    const current = await tx.userBranchAssignment.findFirst({ where: { userId, endedAt: null }, include: { branch: { select: { name: true } } } });
    if (current?.branchId === branchId) return;
    if (current) await tx.userBranchAssignment.update({ where: { id: current.id }, data: { endedAt: new Date() } });
    await tx.userBranchAssignment.create({ data: { userId, branchId, assignedById: actor.userId } });

    await tx.auditLog.create({
      data: auditData(actor, "user.branch_assigned", "user", userId, { branchId, summary: { from: current?.branch.name ?? null, to: branch.name } }),
    });
    await notifyUsers([userId], { type: "branch_assigned", params: { branch: branch.name }, entityType: "branch", entityId: branchId }, tx);
  });
}

// ───────────────────────── Vendors ─────────────────────────

export async function addVendorBranch(actor: Actor, vendorId: string, branchId: string) {
  return db.$transaction(async (tx) => {
    const vendor = await tx.vendorProfile.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new DomainError("notFound");
    const branch = await tx.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new DomainError("notFound");
    if (branch.status !== "ACTIVE") throw new DomainError("branchInactive");
    const existing = await tx.vendorBranchAssignment.findFirst({ where: { vendorId, branchId, removedAt: null } });
    if (existing) return;
    await tx.vendorBranchAssignment.create({ data: { vendorId, branchId, assignedById: actor.userId } });
    await tx.auditLog.create({ data: auditData(actor, "vendor.assignment_added", "vendor", vendorId, { branchId, summary: { branch: branch.name } }) });
    await notifyUsers([vendor.userId], { type: "vendor_branchAssigned", params: { branch: branch.name }, entityType: "branch", entityId: branchId }, tx);
  });
}

/** Removing an assignment never touches historic invoices. */
export async function removeVendorBranch(actor: Actor, vendorId: string, branchId: string) {
  return db.$transaction(async (tx) => {
    const a = await tx.vendorBranchAssignment.findFirst({ where: { vendorId, branchId, removedAt: null }, include: { branch: true, vendor: true } });
    if (!a) throw new DomainError("notFound");
    await tx.vendorBranchAssignment.update({ where: { id: a.id }, data: { removedAt: new Date() } });
    await tx.auditLog.create({ data: auditData(actor, "vendor.assignment_removed", "vendor", vendorId, { branchId, summary: { branch: a.branch.name } }) });
    await notifyUsers([a.vendor.userId], { type: "vendor_branchRemoved", params: { branch: a.branch.name }, entityType: "branch", entityId: branchId }, tx);
  });
}

// ───────────────────────── Account status ─────────────────────────

export async function setAccountSuspended(actor: Actor, userId: string, suspended: boolean) {
  if (userId === actor.userId) throw new DomainError("notAllowed");
  return db.$transaction(async (tx: Tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || !user.role || user.role === "SUPER_ADMIN") throw new DomainError("notAllowed");
    if (suspended && user.status !== "ACTIVE") throw new DomainError("staleRecord");
    if (!suspended && user.status !== "SUSPENDED") throw new DomainError("staleRecord");
    await tx.user.update({ where: { id: userId }, data: { status: suspended ? "SUSPENDED" : "ACTIVE" } });
    if (suspended) await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await notifyUsers([userId], { type: suspended ? "account_suspended" : "account_reactivated", href: "/login", entityType: "user", entityId: userId }, tx);
    await tx.auditLog.create({ data: auditData(actor, suspended ? "account.suspended" : "account.reactivated", "user", userId) });
  });
}

export async function revokeUserSessions(actor: Actor, userId: string) {
  const r = await db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  await db.auditLog.create({ data: auditData(actor, "auth.sessions_revoked", "user", userId, { summary: { count: r.count } }) });
  return r.count;
}

// ───────────────────────── Categories ─────────────────────────

export async function upsertCategory(actor: Actor, id: string | null, input: CategoryInput) {
  const v = categorySchema.parse(input);
  return db.$transaction(async (tx) => {
    const c = id
      ? await tx.expenseCategory.update({ where: { id }, data: v })
      : await tx.expenseCategory.create({ data: { ...v, createdById: actor.userId } });
    await tx.auditLog.create({ data: auditData(actor, id ? "category.updated" : "category.created", "category", c.id, { summary: v }) });
    return c;
  });
}

export async function setCategoryActive(actor: Actor, id: string, isActive: boolean) {
  return db.$transaction(async (tx) => {
    const c = await tx.expenseCategory.update({ where: { id }, data: { isActive } });
    await tx.auditLog.create({ data: auditData(actor, isActive ? "category.activated" : "category.deactivated", "category", id) });
    return c;
  });
}
