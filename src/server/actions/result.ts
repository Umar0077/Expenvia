import "server-only";
import { z } from "zod";
import { DomainError } from "@/server/errors";
import { MoneyError } from "@/lib/finance/money";
import { fieldErrors } from "@/lib/validation/auth";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fields?: Record<string, string> };

/**
 * Wraps an admin/user/vendor mutation: validates input, maps known domain
 * errors to translation keys, and never leaks internals to the client.
 */
export async function runAction<S extends z.ZodType, T>(schema: S, input: unknown, fn: (data: z.infer<S>) => Promise<T>): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validationFailed", fields: fieldErrors(parsed.error) };
  try {
    const data = await fn(parsed.data);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.code };
    if (e instanceof MoneyError) return { ok: false, error: "invalidAmounts" };
    // Re-throw Next.js control-flow errors (redirect/notFound)
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    if ((e as { code?: string })?.code === "P2002") return { ok: false, error: "duplicate" };
    console.error("[expenvia:action]", e);
    return { ok: false, error: "unexpected" };
  }
}
