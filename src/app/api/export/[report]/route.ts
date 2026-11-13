import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionState } from "@/server/auth/session";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { toCsv } from "@/server/csv";
import { buildReport, REPORT_TYPES } from "@/server/services/report-builder";

const MAX_ROWS = 50_000;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);
const uuid = z.string().uuid().optional().catch(undefined);
const day = (d: Date) => d.toISOString().slice(0, 10);

function range(field: string, from?: string, to?: string) {
  if (!from && !to) return {};
  return { [field]: { ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}), ...(to ? { lte: new Date(`${to}T00:00:00Z`) } : {}) } };
}

/** Admin-only CSV exports. Every export (allowed or denied) is audited. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  const state = await getSessionState();
  if (state.kind !== "active") return new NextResponse(null, { status: 401 });
  const actor = state.actor;
  if (actor.role !== "SUPER_ADMIN") {
    await audit({ actorId: actor.userId, actorRole: actor.role, action: "data.exported", entityType: report, outcome: "DENIED" });
    return new NextResponse(null, { status: 403 });
  }
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const from = date.parse(sp.from);
  const to = date.parse(sp.to);
  const branch = uuid.parse(sp.branch);
  let csv: string;
  let count = 0;

  switch (report) {
    case "expenses": {
      const status = z.enum(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REVISION_REQUESTED"]).optional().catch(undefined).parse(sp.status);
      const rows = await db.expense.findMany({
        where: { status: status ?? { not: "DRAFT" }, ...(branch ? { branchId: branch } : {}), ...(uuid.parse(sp.category) ? { categoryId: sp.category } : {}), ...(uuid.parse(sp.owner) ? { ownerId: sp.owner } : {}), ...range("expenseDate", from, to) },
        orderBy: { expenseDate: "asc" },
        take: MAX_ROWS,
        include: { owner: { select: { fullName: true, email: true } }, branch: { select: { code: true, name: true } }, category: { select: { nameEn: true } } },
      });
      count = rows.length;
      csv = toCsv(
        ["Number", "Date", "Title", "Category", "Branch code", "Branch", "Employee", "Employee email", "Payee", "Reference", "Status", "Currency", "Amount", "Submitted at", "Reviewed at"],
        rows.map((e) => [e.number, day(e.expenseDate), e.title, e.category.nameEn, e.branch.code, e.branch.name, e.owner.fullName, e.owner.email, e.payeeName, e.referenceNumber, e.status, e.currency, e.amount.toFixed(2), e.submittedAt?.toISOString(), e.reviewedAt?.toISOString()]),
      );
      break;
    }
    case "invoices": {
      const status = z.enum(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REVISION_REQUESTED", "PARTIALLY_PAID", "PAID"]).optional().catch(undefined).parse(sp.status);
      const outstandingOnly = sp.outstanding === "1";
      const rows = await db.invoice.findMany({
        where: {
          status: outstandingOnly ? { in: ["APPROVED", "PARTIALLY_PAID"] } : (status ?? { not: "DRAFT" }),
          ...(branch ? { branchId: branch } : {}),
          ...(uuid.parse(sp.vendor) ? { vendorId: sp.vendor } : {}),
          ...range("invoiceDate", from, to),
        },
        orderBy: { invoiceDate: "asc" },
        take: MAX_ROWS,
        include: { vendor: { select: { businessName: true } }, branch: { select: { code: true, name: true } } },
      });
      count = rows.length;
      csv = toCsv(
        ["Invoice no.", "Invoice date", "Due date", "Vendor", "Branch code", "Branch", "Status", "Currency", "Subtotal", "Discount", "Tax", "Grand total", "Paid", "Outstanding"],
        rows.map((i) => [i.number, day(i.invoiceDate), i.dueDate ? day(i.dueDate) : "", i.vendor.businessName, i.branch.code, i.branch.name, i.status, i.currency, i.subtotal.toFixed(2), i.discountTotal.toFixed(2), i.taxTotal.toFixed(2), i.grandTotal.toFixed(2), i.amountPaid.toFixed(2), ["APPROVED", "PARTIALLY_PAID"].includes(i.status) ? i.grandTotal.minus(i.amountPaid).toFixed(2) : "0.00"]),
      );
      break;
    }
    case "payments": {
      const rows = await db.invoicePayment.findMany({
        where: { ...range("paymentDate", from, to), ...(uuid.parse(sp.vendor) ? { invoice: { vendorId: sp.vendor } } : {}), ...(branch ? { invoice: { branchId: branch } } : {}) },
        orderBy: { paymentDate: "asc" },
        take: MAX_ROWS,
        include: { invoice: { select: { number: true, currency: true, vendor: { select: { businessName: true } }, branch: { select: { code: true } } } }, recordedBy: { select: { fullName: true } } },
      });
      count = rows.length;
      csv = toCsv(
        ["Payment date", "Invoice no.", "Vendor", "Branch", "Entry type", "Currency", "Amount", "Method", "Reference", "Recorded by", "Recorded at"],
        rows.map((p) => [day(p.paymentDate), p.invoice.number, p.invoice.vendor.businessName, p.invoice.branch.code, p.entryType, p.invoice.currency, p.amount.toFixed(2), p.method, p.reference, p.recordedBy.fullName, p.createdAt.toISOString()]),
      );
      break;
    }
    case "audit": {
      const rows = await db.auditLog.findMany({
        where: { ...range("createdAt", from, to), ...(sp.action ? { action: { startsWith: sp.action.slice(0, 60) } } : {}), ...(uuid.parse(sp.actor) ? { actorId: sp.actor } : {}), ...(branch ? { branchId: branch } : {}) },
        orderBy: { createdAt: "asc" },
        take: MAX_ROWS,
        include: { actor: { select: { fullName: true, email: true } } },
      });
      count = rows.length;
      csv = toCsv(
        ["Timestamp (UTC)", "Actor", "Actor email", "Role", "Action", "Outcome", "Entity type", "Entity id", "Branch id", "Request id", "IP"],
        rows.map((a) => [a.createdAt.toISOString(), a.actor?.fullName, a.actor?.email, a.actorRole, a.action, a.outcome, a.entityType, a.entityId, a.branchId, a.requestId, a.ipAddress]),
      );
      break;
    }
    case "report": {
      const type = z.enum(REPORT_TYPES).catch("summary").parse(sp.type);
      if (!from || !to) return new NextResponse(null, { status: 400 });
      const r = await buildReport(type, { period: { from: new Date(`${from}T00:00:00Z`), to: new Date(`${to}T00:00:00Z`) }, branchId: branch, vendorId: uuid.parse(sp.vendor) });
      count = r.rows.length;
      csv = toCsv(r.columns.map((c) => c.key), r.totals ? [...r.rows, r.totals.map((v, i) => (i === 0 ? "TOTAL" : v))] : r.rows);
      break;
    }
    default:
      return new NextResponse(null, { status: 404 });
  }

  await audit({ actorId: actor.userId, actorRole: actor.role, action: "data.exported", entityType: report, summary: { rows: count, filters: sp } });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenvia-${report === "report" ? sp.type ?? "summary" : report}-${day(new Date())}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
