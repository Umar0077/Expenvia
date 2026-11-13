import { z } from "zod";

const text = (min: number, max: number, minMsg = "required") => z.string().trim().min(min, minMsg).max(max, "tooLong");
const optional = (max: number) => z.string().trim().max(max, "tooLong").optional().default("");

export const branchSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,12}$/, "codeInvalid"),
  name: text(2, 120),
  address: optional(300),
  city: text(2, 80),
  country: text(2, 80),
  contactEmail: z.union([z.literal(""), z.string().trim().toLowerCase().email("emailInvalid").max(254, "tooLong")]).optional().default(""),
  contactPhone: z
    .string()
    .trim()
    .max(24, "tooLong")
    .refine((v) => v === "" || /^\+?[\d\s()-]{7,20}$/.test(v), "phoneInvalid")
    .optional()
    .default(""),
  managerName: optional(120),
  secondaryPhone: z.string().trim().max(24, "tooLong").refine(v => v === "" || /^\+?[\d\s()-]{7,20}$/.test(v), "phoneInvalid").optional(),
  workingDays: z.enum(["", "MON_FRI"]).optional(),
  opensAt: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/, "invalid").optional(),
  closesAt: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/, "invalid").optional(),
  timezone: z.string().trim().max(80).refine(v => { if (!v) return true; try { new Intl.DateTimeFormat("en", {timeZone:v}); return true; } catch { return false; } }, "invalid").optional(),
});
export type BranchInput = z.input<typeof branchSchema>;

export const categorySchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/, "codeInvalid"),
  nameEn: text(2, 80),
  nameUr: text(2, 80),
});
export type CategoryInput = z.input<typeof categorySchema>;
