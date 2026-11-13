import "server-only";
import { db } from "@/server/db";
import { AccessDenied } from "@/server/errors";

/** Runs `fn`; if it throws AccessDenied, writes a DENIED audit record outside any transaction, then rethrows. */
export async function withDenialAudit<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AccessDenied) {
      await db.auditLog.create({ data: { ...e.denial, outcome: "DENIED", summary: { reason: "policy" } } });
    }
    throw e;
  }
}
