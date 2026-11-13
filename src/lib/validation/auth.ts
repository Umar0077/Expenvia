/**
 * Shared (client + server) auth schemas. Error messages are translation keys
 * in the "validation" namespace; the server re-validates everything.
 */
import { z } from "zod";

const email = z.string().trim().toLowerCase().min(1, "required").max(254, "tooLong").email("emailInvalid");
const password = z
  .string()
  .min(10, "passwordWeak")
  .max(200, "tooLong")
  .regex(/[A-Za-z؀-ۿ]/, "passwordWeak")
  .regex(/\d/, "passwordWeak");
const phone = z
  .string()
  .trim()
  .max(24, "tooLong")
  .refine((v) => v === "" || /^\+?[\d\s()-]{7,20}$/.test(v), "phoneInvalid");
const optionalText = (max: number) => z.string().trim().max(max, "tooLong").optional().default("");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "required").max(200, "tooLong"),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    accountType: z.enum(["USER", "VENDOR"], { message: "selectOne" }),
    fullName: z.string().trim().min(2, "nameShort").max(120, "tooLong"),
    email,
    phone,
    password,
    confirmPassword: z.string(),
    businessName: optionalText(160),
    businessAddress: optionalText(300),
    businessCategory: optionalText(80),
    taxIdentifier: optionalText(60),
    applicantNote: optionalText(1000),
    acceptTerms: z.boolean().refine((v) => v, "termsRequired"),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "passwordMismatch" });
    if (v.accountType === "VENDOR") {
      if (v.businessName.length < 2) ctx.addIssue({ code: "custom", path: ["businessName"], message: "businessRequired" });
      if (v.phone === "") ctx.addIssue({ code: "custom", path: ["phone"], message: "required" });
    }
  });
export type SignUpInput = z.input<typeof signUpSchema>;

export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({ token: z.string().min(20).max(200), password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "passwordMismatch" });

/** Flattens zod issues into { field: messageKey } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}
