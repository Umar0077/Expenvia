import { NextResponse, type NextRequest } from "next/server";
import { getSessionState } from "@/server/auth/session";
import { loadSubject } from "@/server/authz/subject";
import { expensePolicy, invoicePolicy } from "@/server/authz/policy";
import { db } from "@/server/db";
import { readObject } from "@/server/storage";
import { audit } from "@/server/audit";

/**
 * Authenticated, authorized private-file download. Never trusts the stored
 * MIME blindly for rendering: images/PDF may be shown inline; everything is
 * sent with nosniff and a sandboxing CSP.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const state = await getSessionState();
  if (state.kind !== "active") return new NextResponse(null, { status: 401 });
  const actor = state.actor;
  const subject = await loadSubject(actor);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });

  let file: { storageKey: string; fileName: string; mimeType: string } | null = null;
  let allowed = false;

  if (kind === "receipt") {
    const a = await db.expenseAttachment.findUnique({ where: { id }, include: { expense: { select: { ownerId: true, branchId: true, status: true } } } });
    if (a) {
      allowed = expensePolicy.view(subject, a.expense);
      file = a;
    }
  } else if (kind === "payment-proof") {
    const p = await db.invoicePayment.findUnique({ where: { id }, include: { invoice: { select: { vendorId: true, branchId: true, status: true } } } });
    if (p?.proofKey) {
      allowed = invoicePolicy.view(subject, p.invoice) && actor.role === "SUPER_ADMIN";
      file = { storageKey: p.proofKey, fileName: `payment-proof-${p.id.slice(0, 8)}`, mimeType: p.proofKey.endsWith(".pdf") ? "application/pdf" : "image/" + (p.proofKey.split(".").pop() === "jpg" ? "jpeg" : p.proofKey.split(".").pop()) };
    }
  }

  if (!file || !allowed) {
    if (file) await audit({ actorId: actor.userId, actorRole: actor.role, action: "file.download", entityType: kind, entityId: id, outcome: "DENIED" });
    // Same response for "missing" and "forbidden" so IDs can't be probed.
    return new NextResponse(null, { status: 404 });
  }

  const body = await readObject(file.storageKey);
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const encoded = encodeURIComponent(file.fileName);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(body.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="file"; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
