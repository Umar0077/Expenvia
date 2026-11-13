"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/session";
import { approveRegistration, rejectRegistration, requestRegistrationInfo } from "@/server/services/registration-service";
import { runAction } from "./result";

const id = z.string().uuid();

export async function approveRegistrationAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(z.object({ id, branchIds: z.array(z.string().uuid()).max(50) }), input, async (d) => {
    await approveRegistration(actor, d);
    revalidatePath("/admin/registrations");
  });
}

export async function rejectRegistrationAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(
    z.object({ id, publicMessage: z.string().trim().max(1000, "tooLong").optional(), internalNote: z.string().trim().max(2000, "tooLong").optional() }),
    input,
    async (d) => {
      await rejectRegistration(actor, d);
      revalidatePath("/admin/registrations");
    },
  );
}

export async function requestInfoAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(z.object({ id, publicMessage: z.string().trim().min(5, "required").max(1000, "tooLong") }), input, async (d) => {
    await requestRegistrationInfo(actor, d);
    revalidatePath("/admin/registrations");
  });
}
