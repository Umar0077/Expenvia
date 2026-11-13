"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth/session";
import { invoiceReviewSchema, invoiceSchema, paymentSchema, supplySchema } from "@/lib/validation/invoice";
import { storeUpload } from "@/server/storage";
import * as invoices from "@/server/services/invoice-service";
import { runAction } from "./result";

export async function saveInvoiceAction(input: unknown) {
  const actor = await requireActor("VENDOR");
  return runAction(
    z.object({ id: z.string().uuid().nullable(), version: z.number().int().positive().optional(), submit: z.boolean(), supplyIds: z.array(z.string().uuid()).max(200).optional(), data: invoiceSchema }),
    input,
    async (d) => {
      const inv = await invoices.saveInvoice(actor, d);
      revalidatePath("/vendor/invoices");
      revalidatePath("/vendor/dashboard");
      return { id: inv.id, status: inv.status, number: inv.number };
    },
  );
}

export async function submitInvoiceAction(input: unknown) {
  const actor = await requireActor("VENDOR");
  return runAction(z.object({ id: z.string().uuid() }), input, async ({ id }) => {
    await invoices.submitInvoice(actor, id);
    revalidatePath(`/vendor/invoices/${id}`);
  });
}

export async function saveSupplyAction(input: unknown) {
  const actor = await requireActor("VENDOR");
  return runAction(supplySchema, input, async (d) => {
    await invoices.saveSupplyRecord(actor, d);
    revalidatePath("/vendor/supplies");
  });
}

export async function reviewInvoiceAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(invoiceReviewSchema, input, async (d) => {
    await invoices.reviewInvoice(actor, d);
    revalidatePath(`/admin/invoices/${d.id}`);
    revalidatePath("/admin/invoices");
  });
}

/** FormData: `payload` JSON (paymentSchema) + optional `proof` file. */
export async function recordPaymentAction(form: FormData) {
  const actor = await requireActor("SUPER_ADMIN");
  let json: unknown = null;
  try {
    json = JSON.parse(String(form.get("payload") ?? "null"));
  } catch {}
  return runAction(paymentSchema, json, async (d) => {
    const proof = form.get("proof");
    const stored = proof instanceof File && proof.size > 0 ? await storeUpload(proof, "payments") : null;
    await invoices.recordPayment(actor, { ...d, proofKey: stored?.storageKey ?? null });
    revalidatePath(`/admin/invoices/${d.invoiceId}`);
    revalidatePath("/admin/payments");
  });
}

export async function correctPaymentAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(z.object({ paymentId: z.string().uuid(), reason: z.string().trim().min(3, "required").max(500, "tooLong"), idempotencyKey: z.string().uuid() }), input, async (d) => {
    await invoices.correctPayment(actor, d);
    revalidatePath("/admin/payments");
  });
}

export async function linkReconciliationAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(
    z.object({ expenseId: z.string().uuid(), invoiceId: z.string().uuid(), type: z.enum(["DUPLICATE_OF", "RELATED"]), note: z.string().trim().max(500).optional() }),
    input,
    async (d) => {
      await invoices.linkExpenseToInvoice(actor, d);
      revalidatePath("/admin/reports");
      revalidatePath(`/admin/invoices/${d.invoiceId}`);
    },
  );
}

export async function unlinkReconciliationAction(input: unknown) {
  const actor = await requireActor("SUPER_ADMIN");
  return runAction(z.object({ id: z.string().uuid(), invoiceId: z.string().uuid() }), input, async ({ id, invoiceId }) => {
    await invoices.unlinkReconciliation(actor, id);
    revalidatePath(`/admin/invoices/${invoiceId}`);
  });
}
