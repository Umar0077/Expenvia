"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/server/auth/session";
import { rateLimit } from "@/server/auth/rate-limit";
import { db } from "@/server/db";
import { retryEmail } from "@/server/email/worker";
import { DomainError } from "@/server/errors";
import { runAction } from "./result";

export async function retryEmailAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(z.object({ id: z.string().uuid() }), input, async ({ id }) => {
    if (!(await rateLimit(`email-retry:${actor.userId}`, 20, 60))) throw new DomainError("rateLimited");
    if (!(await db.$transaction(tx => retryEmail(tx, id, actor.userId)))) throw new DomainError("alreadyProcessed");
    revalidatePath("/admin/email-delivery");
  });
}
