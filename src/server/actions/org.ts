"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/session";
import { branchSchema, categorySchema } from "@/lib/validation/org";
import * as org from "@/server/services/org-service";
import { runAction } from "./result";

const uuid = z.string().uuid();

export async function saveBranchAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(z.object({ id: uuid.nullable(), data: branchSchema }), input, async ({ id, data }) => {
    const b = id ? await org.updateBranch(actor, id, data) : await org.createBranch(actor, data);
    revalidatePath("/admin/branches");
    return { id: b.id };
  });
}

export async function setBranchStatusAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(z.object({ id: uuid, status: z.enum(["ACTIVE", "INACTIVE"]) }), input, async ({ id, status }) => {
    await org.setBranchStatus(actor, id, status);
    revalidatePath("/admin/branches");
  });
}

export async function assignEmployeeBranchAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(z.object({ userId: uuid, branchId: uuid }), input, async ({ userId, branchId }) => {
    await org.assignEmployeeBranch(actor, userId, branchId);
    revalidatePath("/admin/users");
  });
}

export async function vendorBranchAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(z.object({ vendorId: uuid, branchId: uuid, op: z.enum(["add", "remove"]) }), input, async ({ vendorId, branchId, op }) => {
    if (op === "add") await org.addVendorBranch(actor, vendorId, branchId);
    else await org.removeVendorBranch(actor, vendorId, branchId);
    revalidatePath("/admin/vendors");
  });
}

export async function setSuspendedAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(z.object({ userId: uuid, suspended: z.boolean() }), input, async ({ userId, suspended }) => {
    await org.setAccountSuspended(actor, userId, suspended);
    revalidatePath("/admin/users");
    revalidatePath("/admin/vendors");
  });
}

export async function revokeSessionsAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(z.object({ userId: uuid }), input, async ({ userId }) => {
    await org.revokeUserSessions(actor, userId);
  });
}

export async function saveCategoryAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(z.object({ id: uuid.nullable(), data: categorySchema }), input, async ({ id, data }) => {
    await org.upsertCategory(actor, id, data);
    revalidatePath("/admin/categories");
  });
}

export async function setCategoryActiveAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(z.object({ id: uuid, isActive: z.boolean() }), input, async ({ id, isActive }) => {
    await org.setCategoryActive(actor, id, isActive);
    revalidatePath("/admin/categories");
  });
}
