import "server-only";
import { db } from "@/server/db";
import { dec } from "@/lib/finance/money";
import { approvedTotals, REPORTING_CURRENCY, spendByBranch, spendByCategory, type Period } from "./reporting-service";

export const REPORT_TYPES = ["summary", "branch", "category", "employee", "vendor", "outstanding", "approval", "payments"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/** Column = translation key in "reports" + whether it holds money/number (end-aligned). */
export interface Column { key: string; kind?: "money" | "number" | "percent" | "text" }
export interface Report { columns: Column[]; rows: (string | number)[][]; totals?: (string | number | null)[] }

export interface ReportFilters { period: Period; branchId?: string; vendorId?: string }

const pct = (part: string, whole: string) => (dec(whole).isZero() ? "0" : dec(part).dividedBy(dec(whole)).times(100).toFixed(1));

/**
 * Builds a report as plain rows (exact decimal strings). The same output feeds
 * the on-screen table and the CSV export, so the two can never disagree.
 */
export async function buildReport(type: ReportType, f: ReportFilters): Promise<Report> {
  const branchIds = f.branchId ? [f.branchId] : undefined;
  const { from, to } = f.period;

  switch (type) {
    case "summary": {
      const [t, pendingE, pendingI, out, paid] = await Promise.all([
        approvedTotals(f.period, branchIds),
        db.expense.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, ...(f.branchId ? { branchId: f.branchId } : {}) } }),
        db.invoice.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, ...(f.branchId ? { branchId: f.branchId } : {}) } }),
        db.$queryRaw<{ v: string }[]>`SELECT COALESCE(SUM(grand_total - amount_paid),0)::text v FROM invoices WHERE status IN ('APPROVED','PARTIALLY_PAID') AND currency = ${REPORTING_CURRENCY} AND (${f.branchId ?? null}::uuid IS NULL OR branch_id = ${f.branchId ?? null}::uuid)`,
        db.$queryRaw<{ v: string }[]>`SELECT COALESCE(SUM(p.amount),0)::text v FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.currency = ${REPORTING_CURRENCY} AND p.payment_date BETWEEN ${from}::date AND ${to}::date AND (${f.branchId ?? null}::uuid IS NULL OR i.branch_id = ${f.branchId ?? null}::uuid)`,
      ]);
      return {
        columns: [{ key: "metric" }, { key: "value", kind: "money" }],
        rows: [
          ["approvedSpending", t.total],
          ["employeeExpenses", t.employee],
          ["vendorInvoices", t.vendor],
          ["paymentsInPeriod", paid[0]?.v ?? "0"],
          ["outstanding", out[0]?.v ?? "0"],
          ["pendingExpenses", String(pendingE)],
          ["pendingInvoices", String(pendingI)],
        ],
      };
    }
    case "branch": {
      const rows = await spendByBranch(f.period, branchIds);
      const total = rows.reduce((a, r) => a.plus(dec(r.total)), dec(0)).toFixed(2);
      return {
        columns: [{ key: "branch" }, { key: "employee", kind: "money" }, { key: "vendor", kind: "money" }, { key: "total", kind: "money" }, { key: "share", kind: "percent" }],
        rows: rows.map((r) => [`${r.name} (${r.code})`, r.employee, r.vendor, r.total, pct(r.total, total)]),
        totals: [null, rows.reduce((a, r) => a.plus(dec(r.employee)), dec(0)).toFixed(2), rows.reduce((a, r) => a.plus(dec(r.vendor)), dec(0)).toFixed(2), total, "100.0"],
      };
    }
    case "category": {
      const rows = await spendByCategory(f.period, branchIds);
      const total = rows.reduce((a, r) => a.plus(dec(r.total)), dec(0)).toFixed(2);
      return {
        columns: [{ key: "category" }, { key: "count", kind: "number" }, { key: "approved", kind: "money" }, { key: "share", kind: "percent" }],
        rows: rows.map((r) => [`${r.nameEn} / ${r.nameUr}`, r.count, r.total, pct(r.total, total)]),
        totals: [null, rows.reduce((a, r) => a + r.count, 0), total, "100.0"],
      };
    }
    case "employee": {
      const rows = await db.$queryRaw<{ name: string; branch: string | null; count: number; approved: string; pending: string; rejected: string }[]>`
        SELECT u.full_name AS name, b.code AS branch, COUNT(e.id)::int AS count,
          COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'APPROVED'),0)::text AS approved,
          COALESCE(SUM(e.amount) FILTER (WHERE e.status IN ('SUBMITTED','UNDER_REVIEW')),0)::text AS pending,
          COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'REJECTED'),0)::text AS rejected
        FROM users u
        JOIN expenses e ON e.owner_id = u.id AND e.status <> 'DRAFT' AND e.currency = ${REPORTING_CURRENCY} AND e.expense_date BETWEEN ${from}::date AND ${to}::date
          AND (${f.branchId ?? null}::uuid IS NULL OR e.branch_id = ${f.branchId ?? null}::uuid)
        LEFT JOIN user_branch_assignments a ON a.user_id = u.id AND a.ended_at IS NULL
        LEFT JOIN branches b ON b.id = a.branch_id
        GROUP BY u.id, b.code ORDER BY 4 DESC`;
      return {
        columns: [{ key: "employee" }, { key: "branch" }, { key: "count", kind: "number" }, { key: "approved", kind: "money" }, { key: "pending", kind: "money" }, { key: "rejected", kind: "money" }],
        rows: rows.map((r) => [r.name, r.branch ?? "—", r.count, r.approved, r.pending, r.rejected]),
      };
    }
    case "vendor": {
      const rows = await db.$queryRaw<{ vendor: string; count: number; invoiced: string; paid: string; outstanding: string }[]>`
        SELECT v.business_name AS vendor, COUNT(i.id)::int AS count,
          COALESCE(SUM(i.grand_total) FILTER (WHERE i.status IN ('APPROVED','PARTIALLY_PAID','PAID')),0)::text AS invoiced,
          COALESCE(SUM(i.amount_paid),0)::text AS paid,
          COALESCE(SUM(i.grand_total - i.amount_paid) FILTER (WHERE i.status IN ('APPROVED','PARTIALLY_PAID')),0)::text AS outstanding
        FROM vendor_profiles v
        JOIN invoices i ON i.vendor_id = v.id AND i.status <> 'DRAFT' AND i.currency = ${REPORTING_CURRENCY} AND i.invoice_date BETWEEN ${from}::date AND ${to}::date
          AND (${f.branchId ?? null}::uuid IS NULL OR i.branch_id = ${f.branchId ?? null}::uuid)
          AND (${f.vendorId ?? null}::uuid IS NULL OR v.id = ${f.vendorId ?? null}::uuid)
        GROUP BY v.id ORDER BY 3 DESC`;
      return {
        columns: [{ key: "vendor" }, { key: "count", kind: "number" }, { key: "invoiced", kind: "money" }, { key: "paid", kind: "money" }, { key: "outstanding", kind: "money" }],
        rows: rows.map((r) => [r.vendor, r.count, r.invoiced, r.paid, r.outstanding]),
      };
    }
    case "outstanding": {
      const rows = await db.invoice.findMany({
        where: { status: { in: ["APPROVED", "PARTIALLY_PAID"] }, currency: REPORTING_CURRENCY, ...(f.branchId ? { branchId: f.branchId } : {}), ...(f.vendorId ? { vendorId: f.vendorId } : {}) },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
        include: { vendor: { select: { businessName: true } }, branch: { select: { code: true } } },
      });
      return {
        columns: [{ key: "invoice" }, { key: "vendor" }, { key: "branch" }, { key: "dueDate" }, { key: "invoiced", kind: "money" }, { key: "paid", kind: "money" }, { key: "outstanding", kind: "money" }],
        rows: rows.map((i) => [i.number, i.vendor.businessName, i.branch.code, i.dueDate?.toISOString().slice(0, 10) ?? "—", i.grandTotal.toFixed(2), i.amountPaid.toFixed(2), i.grandTotal.minus(i.amountPaid).toFixed(2)]),
      };
    }
    case "approval": {
      const rows = await db.$queryRaw<{ kind: string; decided: number; approved: number; rejected: number; avg_hours: string | null }[]>`
        SELECT 'expenses' AS kind, COUNT(*)::int AS decided, COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved, COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected,
          ROUND(AVG(EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) / 3600)::numeric, 1)::text AS avg_hours
        FROM expenses WHERE reviewed_at IS NOT NULL AND reviewed_at::date BETWEEN ${from}::date AND ${to}::date AND (${f.branchId ?? null}::uuid IS NULL OR branch_id = ${f.branchId ?? null}::uuid)
        UNION ALL
        SELECT 'invoices', COUNT(*)::int, COUNT(*) FILTER (WHERE h.to_status = 'APPROVED')::int, COUNT(*) FILTER (WHERE h.to_status = 'REJECTED')::int,
          ROUND(AVG(EXTRACT(EPOCH FROM (h.created_at - i.submitted_at)) / 3600)::numeric, 1)::text
        FROM invoice_status_history h JOIN invoices i ON i.id = h.invoice_id
        WHERE h.to_status IN ('APPROVED','REJECTED','REVISION_REQUESTED') AND h.created_at::date BETWEEN ${from}::date AND ${to}::date AND (${f.branchId ?? null}::uuid IS NULL OR i.branch_id = ${f.branchId ?? null}::uuid)`;
      return {
        columns: [{ key: "type" }, { key: "decided", kind: "number" }, { key: "approved", kind: "number" }, { key: "rejected", kind: "number" }, { key: "approvalRate", kind: "percent" }, { key: "avgHours", kind: "number" }],
        rows: rows.map((r) => [r.kind, r.decided, r.approved, r.rejected, r.decided ? ((r.approved / r.decided) * 100).toFixed(1) : "0.0", r.avg_hours ?? "—"]),
      };
    }
    case "payments": {
      const rows = await db.invoicePayment.findMany({
        where: { paymentDate: { gte: from, lte: to }, invoice: { currency: REPORTING_CURRENCY, ...(f.branchId ? { branchId: f.branchId } : {}), ...(f.vendorId ? { vendorId: f.vendorId } : {}) } },
        orderBy: { paymentDate: "asc" },
        include: { invoice: { select: { number: true, vendor: { select: { businessName: true } } } } },
      });
      return {
        columns: [{ key: "date" }, { key: "invoice" }, { key: "vendor" }, { key: "type" }, { key: "paid", kind: "money" }],
        rows: rows.map((p) => [p.paymentDate.toISOString().slice(0, 10), p.invoice.number, p.invoice.vendor.businessName, p.entryType, p.amount.toFixed(2)]),
        totals: [null, null, null, null, rows.reduce((a, p) => a.plus(dec(p.amount.toString())), dec(0)).toFixed(2)],
      };
    }
  }
}
