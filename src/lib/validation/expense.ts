import { z } from "zod";

export const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "SAR"] as const;
export const PAYMENT_METHODS = ["CASH", "CARD", "BANK_TRANSFER", "CHEQUE", "MOBILE_WALLET", "OTHER"] as const;

/** Decimal string with at most `dp` places — never parsed through float. */
export const decimalString = (opts: { dp: number; min?: "positive" | "nonNegative"; max?: string; msg?: string }) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/,/g, ""))
    .refine((v) => /^\d{1,13}(\.\d+)?$/.test(v), opts.msg ?? "amountInvalid")
    .refine((v) => !v.includes(".") || v.split(".")[1]!.length <= opts.dp, opts.dp === 2 ? "amountPrecision" : "amountInvalid")
    .refine((v) => (opts.min === "nonNegative" ? true : /[1-9]/.test(v)), opts.msg ?? "amountInvalid");

const today = () => new Date().toISOString().slice(0, 10);

export const expenseSchema = z.object({
  categoryId: z.string().uuid("selectOne"),
  title: z.string().trim().min(2, "required").max(160, "tooLong"),
  description: z.string().trim().max(2000, "tooLong").optional().default(""),
  amount: decimalString({ dp: 2 }),
  currency: z.enum(CURRENCIES).default("PKR"),
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateInvalid")
    .refine((v) => !Number.isNaN(Date.parse(v)), "dateInvalid")
    .refine((v) => v <= today(), "dateFuture"),
  payeeName: z.string().trim().max(160, "tooLong").optional().default(""),
  paymentMethod: z.union([z.literal(""), z.enum(PAYMENT_METHODS)]).optional().default(""),
  referenceNumber: z.string().trim().max(80, "tooLong").optional().default(""),
});
export type ExpenseInput = z.input<typeof expenseSchema>;
export type ExpenseData = z.output<typeof expenseSchema>;

export const reviewSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  decision: z.enum(["APPROVED", "REJECTED", "REVISION_REQUESTED"]),
  note: z.string().trim().max(1000, "tooLong").optional().default(""),
});
