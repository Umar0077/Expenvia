import { z } from "zod";
import { CURRENCIES, decimalString, PAYMENT_METHODS } from "./expense";

export const MAX_LINES = 200;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateInvalid").refine((v) => !Number.isNaN(Date.parse(v)), "dateInvalid");
const optionalDate = z.union([z.literal(""), isoDate]).optional().default("");

export const lineSchema = z
  .object({
    itemName: z.string().trim().min(1, "required").max(200, "tooLong"),
    description: z.string().trim().max(1000, "tooLong").optional().default(""),
    quantity: decimalString({ dp: 4, msg: "quantityInvalid" }),
    unit: z.string().trim().min(1, "required").max(20, "tooLong"),
    unitPrice: decimalString({ dp: 4, min: "nonNegative" }),
    taxRate: z
      .string()
      .trim()
      .default("0")
      .refine((v) => v === "" || (/^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 100), "percentInvalid")
      .transform((v) => v || "0"),
    discount: z
      .string()
      .trim()
      .default("0")
      .transform((v) => v.replace(/,/g, "") || "0")
      .refine((v) => /^\d{1,13}(\.\d{1,2})?$/.test(v), "amountInvalid"),
  });
export type LineInput = z.input<typeof lineSchema>;

export const invoiceSchema = z
  .object({
    branchId: z.string().uuid("selectOne"),
    currency: z.enum(CURRENCIES).default("PKR"),
    invoiceDate: isoDate,
    supplyDate: optionalDate,
    dueDate: optionalDate,
    notes: z.string().trim().max(2000, "tooLong").optional().default(""),
    paymentTerms: z.string().trim().max(500, "tooLong").optional().default(""),
    paymentDetails: z.string().trim().max(1000, "tooLong").optional().default(""),
    lines: z.array(lineSchema).min(1, "lineItemsRequired").max(MAX_LINES, "tooLong"),
  })
  .superRefine((v, ctx) => {
    if (v.dueDate && v.dueDate < v.invoiceDate) ctx.addIssue({ code: "custom", path: ["dueDate"], message: "dueBeforeInvoice" });
  });
export type InvoiceInput = z.input<typeof invoiceSchema>;
export type InvoiceData = z.output<typeof invoiceSchema>;

export const supplySchema = z.object({
  branchId: z.string().uuid("selectOne"),
  supplyDate: isoDate.refine((v) => v <= new Date().toISOString().slice(0, 10), "dateFuture"),
  itemName: z.string().trim().min(1, "required").max(200, "tooLong"),
  description: z.string().trim().max(1000, "tooLong").optional().default(""),
  quantity: decimalString({ dp: 4, msg: "quantityInvalid" }),
  unit: z.string().trim().min(1, "required").max(20, "tooLong"),
  unitPrice: decimalString({ dp: 4, min: "nonNegative" }),
  taxRate: z.string().trim().default("0").refine((v) => v === "" || (/^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 100), "percentInvalid").transform((v) => v || "0"),
  discount: z.string().trim().default("0").transform((v) => v.replace(/,/g, "") || "0").refine((v) => /^\d{1,13}(\.\d{1,2})?$/.test(v), "amountInvalid"),
  notes: z.string().trim().max(1000, "tooLong").optional().default(""),
});
export type SupplyInput = z.input<typeof supplySchema>;

export const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: decimalString({ dp: 2 }),
  paymentDate: isoDate.refine((v) => v <= new Date().toISOString().slice(0, 10), "dateFuture"),
  method: z.union([z.literal(""), z.enum(PAYMENT_METHODS)]).optional().default(""),
  reference: z.string().trim().max(120, "tooLong").optional().default(""),
  notes: z.string().trim().max(1000, "tooLong").optional().default(""),
  idempotencyKey: z.string().uuid(),
});
export type PaymentInput = z.input<typeof paymentSchema>;

export const invoiceReviewSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED", "REVISION_REQUESTED"]),
  note: z.string().trim().max(1000, "tooLong").optional().default(""),
});
