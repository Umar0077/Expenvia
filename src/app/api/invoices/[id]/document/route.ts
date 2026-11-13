import { NextResponse, type NextRequest } from "next/server";
import { getSessionState } from "@/server/auth/session";
import { loadSubject } from "@/server/authz/subject";
import { invoicePolicy } from "@/server/authz/policy";
import { audit } from "@/server/audit";
import { loadInvoiceForDocument, renderInvoiceHtml } from "@/server/invoice-document";
import { htmlToPdf } from "@/server/pdf";
import { isAppLocale } from "@/i18n/config";

export const runtime = "nodejs";

/** Invoice document: ?format=html (preview) | pdf (download). Only the owning vendor or a Super Admin. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await getSessionState();
  if (state.kind !== "active") return new NextResponse(null, { status: 401 });
  const actor = state.actor;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });

  const inv = await loadInvoiceForDocument(id);
  const subject = await loadSubject(actor);
  if (!inv || !invoicePolicy.view(subject, inv)) {
    if (inv) await audit({ actorId: actor.userId, actorRole: actor.role, action: "invoice.document", entityType: "invoice", entityId: id, outcome: "DENIED" });
    return new NextResponse(null, { status: 404 });
  }

  const langParam = req.nextUrl.searchParams.get("lang");
  const locale = isAppLocale(langParam) ? langParam : "en";
  const html = await renderInvoiceHtml(inv, locale);
  const common = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

  if (req.nextUrl.searchParams.get("format") === "pdf") {
    const pdf = await htmlToPdf(html, locale === "ur" ? "صفحہ" : "Page");
    await audit({ actorId: actor.userId, actorRole: actor.role, action: "invoice.pdf_downloaded", entityType: "invoice", entityId: id, branchId: inv.branchId });
    return new NextResponse(new Uint8Array(pdf), {
      headers: { ...common, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${inv.number}.pdf"` },
    });
  }
  return new NextResponse(html, {
    headers: {
      ...common,
      "Content-Type": "text/html; charset=utf-8",
      // Preview is static: no scripts, only embedded fonts/images.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; frame-ancestors 'self'",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
