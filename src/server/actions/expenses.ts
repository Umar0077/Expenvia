"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/session";
import { expenseSchema, reviewSchema } from "@/lib/validation/expense";
import { MAX_UPLOAD_BYTES, storeUpload, type StoredFile } from "@/server/storage";
import * as expenses from "@/server/services/expense-service";
import { runAction } from "./result";
import { DomainError } from "@/server/errors";

const payload = z.object({
  id: z.string().uuid().nullable(),
  version: z.coerce.number().int().positive().optional(),
  submit: z.boolean(),
  data: expenseSchema,
});

/** Accepts FormData: `payload` (JSON) + zero or more `files`. */
export async function saveExpenseAction(form: FormData) {
  const actor = await requireActor("USER");
  let parsedJson: unknown = null;
  try {
    parsedJson = JSON.parse(String(form.get("payload") ?? "null"));
  } catch {
    parsedJson = null;
  }
  return runAction(payload, parsedJson, async (input) => {
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > expenses.MAX_ATTACHMENTS) throw new DomainError("tooManyFiles");
    if (files.some((f) => f.size > MAX_UPLOAD_BYTES)) throw new DomainError("fileSize");
    const stored: StoredFile[] = [];
    for (const f of files) stored.push(await storeUpload(f, "receipts"));
    const e = await expenses.saveExpense(actor, { ...input, files: stored });
    revalidatePath("/user/expenses");
    revalidatePath("/user/dashboard");
    return { id: e.id, status: e.status };
  });
}

export async function submitExpenseAction(input: unknown) {
  const actor = await requireActor("USER");
  return runAction(z.object({ id: z.string().uuid() }), input, async ({ id }) => {
    await expenses.submitExpense(actor, id);
    revalidatePath("/user/expenses");
  });
}

export async function removeAttachmentAction(input: unknown) {
  const actor = await requireActor("USER");
  return runAction(z.object({ id: z.string().uuid() }), input, async ({ id }) => {
    await expenses.removeAttachment(actor, id);
  });
}

export async function reviewExpensesAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(reviewSchema, input, async (d) => {
    const r = await expenses.reviewExpenses(actor, d);
    revalidatePath("/admin/approvals");
    revalidatePath("/admin/expenses");
    return r;
  });
}
