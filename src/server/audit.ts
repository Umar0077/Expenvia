import "server-only";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { db, type Tx } from "@/server/db";
import type { AuditOutcome, Role } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { clientIp } from "@/server/auth/session";

const REDACT = /password|token|secret|hash|cookie|authorization|card|cvv|iban/i;

/** Strips anything that looks sensitive before it is written to the audit log. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

export interface AuditEvent {
  actorId?: string | null;
  actorRole?: Role | null;
  action: string; // e.g. "expense.approved"
  entityType?: string;
  entityId?: string;
  branchId?: string | null;
  outcome?: AuditOutcome;
  summary?: Record<string, unknown>;
}

/** Writes an audit record. Pass `tx` to make it part of the same DB transaction as the change. */
export async function audit(event: AuditEvent, tx?: Tx): Promise<void> {
  let h: Headers | null = null;
  try {
    h = await headers();
  } catch {
    h = null; // called outside a request (scripts)
  }
  const client = tx ?? db;
  await client.auditLog.create({
    data: {
      actorId: event.actorId ?? null,
      actorRole: event.actorRole ?? null,
      action: event.action,
      entityType: event.entityType ?? null,
      entityId: event.entityId ?? null,
      branchId: event.branchId ?? null,
      outcome: event.outcome ?? "SUCCESS",
      summary: event.summary ? (redact(event.summary) as Prisma.InputJsonValue) : undefined,
      requestId: h?.get("x-request-id") ?? randomUUID(),
      ipAddress: h ? clientIp(h) : null,
      userAgent: h?.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
}
