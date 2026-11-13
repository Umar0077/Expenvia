import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { dec } from "@/lib/finance/money";

/**
 * ─── Expenvia aggregation policy (docs/financial-policy.md) ───
 * "Approved spending" for a period =
 *   Σ employee expenses with status APPROVED (by expense_date)
 *     EXCLUDING any expense actively reconciled as DUPLICATE_OF a vendor invoice
 * + Σ vendor invoices with status APPROVED / PARTIALLY_PAID / PAID (grand_total, by invoice_date)
 *
 * Drafts, submitted/under-review, rejected and revision-requested records are never
 * included in approved totals. "Pending" counts SUBMITTED + UNDER_REVIEW only.
 * "Outstanding" = Σ (grand_total − amount_paid) for APPROVED / PARTIALLY_PAID invoices.
 * Amounts are summed per currency; the app's reporting currency is PKR and
 * figures in other currencies are reported separately, never converted silently.
 */

export const APPROVED_INVOICE_STATUSES = ["APPROVED", "PARTIALLY_PAID", "PAID"] as const;
export const PENDING_STATUSES = ["SUBMITTED", "UNDER_REVIEW"] as const;
export const REPORTING_CURRENCY = "PKR";

export interface Period {
  from: Date; // inclusive (date)
  to: Date; // inclusive (date)
}

const NOT_DUPLICATE = Prisma.sql`NOT EXISTS (
  SELECT 1 FROM financial_reconciliations r
  WHERE r.expense_id = e.id AND r.type = 'DUPLICATE_OF' AND r.unlinked_at IS NULL)`;

function branchFilter(alias: string, branchIds?: string[]) {
  return branchIds && branchIds.length ? Prisma.sql`AND ${Prisma.raw(alias)}.branch_id = ANY(${branchIds}::uuid[])` : Prisma.empty;
}

export interface Totals {
  employee: string;
  vendor: string;
  total: string;
}

/** Approved spending totals (strings, exact decimals). */
export async function approvedTotals(period: Period, branchIds?: string[]): Promise<Totals> {
  const [row] = await db.$queryRaw<{ employee: string; vendor: string }[]>`
    SELECT
      (SELECT COALESCE(SUM(e.amount), 0)::text FROM expenses e
        WHERE e.status = 'APPROVED' AND e.currency = ${REPORTING_CURRENCY}
          AND e.expense_date BETWEEN ${period.from}::date AND ${period.to}::date
          AND ${NOT_DUPLICATE} ${branchFilter("e", branchIds)}) AS employee,
      (SELECT COALESCE(SUM(i.grand_total), 0)::text FROM invoices i
        WHERE i.status IN ('APPROVED','PARTIALLY_PAID','PAID') AND i.currency = ${REPORTING_CURRENCY}
          AND i.invoice_date BETWEEN ${period.from}::date AND ${period.to}::date
          ${branchFilter("i", branchIds)}) AS vendor`;
  const employee = row?.employee ?? "0";
  const vendor = row?.vendor ?? "0";
  return { employee, vendor, total: dec(employee).plus(dec(vendor)).toFixed(2) };
}

export interface BranchSummary {
  branchId: string;
  approved: string;
  pending: number;
  outstanding: string;
}

export async function branchSummaries(period: Period): Promise<Map<string, BranchSummary>> {
  const rows = await db.$queryRaw<{ branch_id: string; approved: string; pending: number; outstanding: string }[]>`
    SELECT b.id AS branch_id,
      (COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.branch_id = b.id AND e.status = 'APPROVED'
          AND e.currency = ${REPORTING_CURRENCY}
          AND e.expense_date BETWEEN ${period.from}::date AND ${period.to}::date AND ${NOT_DUPLICATE}), 0)
       + COALESCE((SELECT SUM(i.grand_total) FROM invoices i WHERE i.branch_id = b.id
          AND i.status IN ('APPROVED','PARTIALLY_PAID','PAID') AND i.currency = ${REPORTING_CURRENCY}
          AND i.invoice_date BETWEEN ${period.from}::date AND ${period.to}::date), 0))::text AS approved,
      ((SELECT COUNT(*) FROM expenses e WHERE e.branch_id = b.id AND e.status IN ('SUBMITTED','UNDER_REVIEW'))
       + (SELECT COUNT(*) FROM invoices i WHERE i.branch_id = b.id AND i.status IN ('SUBMITTED','UNDER_REVIEW')))::int AS pending,
      COALESCE((SELECT SUM(i.grand_total - i.amount_paid) FROM invoices i WHERE i.branch_id = b.id
          AND i.status IN ('APPROVED','PARTIALLY_PAID') AND i.currency = ${REPORTING_CURRENCY}), 0)::text AS outstanding
    FROM branches b`;
  return new Map(rows.map((r) => [r.branch_id, { branchId: r.branch_id, approved: r.approved, pending: r.pending, outstanding: r.outstanding }]));
}

export function currentMonth(now = new Date()): Period {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return { from: new Date(Date.UTC(y, m, 1)), to: new Date(Date.UTC(y, m + 1, 0)) };
}

// ───────────────────────── Periods ─────────────────────────

export const PERIOD_KEYS = ["month", "lastMonth", "quarter", "ytd", "last12"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

/** Resolves a named period and the equally long period immediately before it. */
export function resolvePeriod(key: PeriodKey, now = new Date()): { current: Period; previous: Period } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  let from: Date, to: Date;
  switch (key) {
    case "lastMonth": from = utc(y, m - 1, 1); to = utc(y, m, 0); break;
    case "quarter": { const q = Math.floor(m / 3) * 3; from = utc(y, q, 1); to = utc(y, q + 3, 0); break; }
    case "ytd": from = utc(y, 0, 1); to = utc(y, 11, 31); break;
    case "last12": from = utc(y, m - 11, 1); to = utc(y, m + 1, 0); break;
    default: from = utc(y, m, 1); to = utc(y, m + 1, 0);
  }
  const months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth() + 1;
  const previous = { from: utc(from.getUTCFullYear(), from.getUTCMonth() - months, 1), to: utc(from.getUTCFullYear(), from.getUTCMonth(), 0) };
  return { current: { from, to }, previous };
}

export interface MonthPoint { month: string; employee: string; vendor: string }

/** Approved spending per calendar month (same policy as approvedTotals). Months with no data are zero-filled. */
export async function monthlyTrend(period: Period, branchIds?: string[]): Promise<MonthPoint[]> {
  const rows = await db.$queryRaw<{ month: string; employee: string; vendor: string }[]>`
    WITH months AS (
      SELECT to_char(gs, 'YYYY-MM') AS month FROM generate_series(date_trunc('month', ${period.from}::date), date_trunc('month', ${period.to}::date), interval '1 month') gs
    ),
    e AS (
      SELECT to_char(e.expense_date, 'YYYY-MM') AS month, SUM(e.amount) AS amt FROM expenses e
      WHERE e.status = 'APPROVED' AND e.currency = ${REPORTING_CURRENCY} AND e.expense_date BETWEEN ${period.from}::date AND ${period.to}::date
        AND ${NOT_DUPLICATE} ${branchFilter("e", branchIds)}
      GROUP BY 1
    ),
    i AS (
      SELECT to_char(i.invoice_date, 'YYYY-MM') AS month, SUM(i.grand_total) AS amt FROM invoices i
      WHERE i.status IN ('APPROVED','PARTIALLY_PAID','PAID') AND i.currency = ${REPORTING_CURRENCY}
        AND i.invoice_date BETWEEN ${period.from}::date AND ${period.to}::date ${branchFilter("i", branchIds)}
      GROUP BY 1
    )
    SELECT months.month, COALESCE(e.amt, 0)::text AS employee, COALESCE(i.amt, 0)::text AS vendor
    FROM months LEFT JOIN e USING (month) LEFT JOIN i USING (month) ORDER BY months.month`;
  return rows;
}

export interface CategoryRow { categoryId: string; nameEn: string; nameUr: string; total: string; count: number }

/** Employee expenses by category (vendor invoices are not categorized). */
export async function spendByCategory(period: Period, branchIds?: string[]): Promise<CategoryRow[]> {
  return db.$queryRaw<CategoryRow[]>`
    SELECT c.id AS "categoryId", c.name_en AS "nameEn", c.name_ur AS "nameUr", SUM(e.amount)::text AS total, COUNT(*)::int AS count
    FROM expenses e JOIN expense_categories c ON c.id = e.category_id
    WHERE e.status = 'APPROVED' AND e.currency = ${REPORTING_CURRENCY}
      AND e.expense_date BETWEEN ${period.from}::date AND ${period.to}::date
      AND ${NOT_DUPLICATE} ${branchFilter("e", branchIds)}
    GROUP BY c.id ORDER BY SUM(e.amount) DESC`;
}

export interface BranchSpend { branchId: string; code: string; name: string; employee: string; vendor: string; total: string }

export async function spendByBranch(period: Period, branchIds?: string[]): Promise<BranchSpend[]> {
  return db.$queryRaw<BranchSpend[]>`
    SELECT b.id AS "branchId", b.code, b.name,
      COALESCE(e.amt, 0)::text AS employee, COALESCE(i.amt, 0)::text AS vendor, (COALESCE(e.amt, 0) + COALESCE(i.amt, 0))::text AS total
    FROM branches b
    LEFT JOIN (SELECT e.branch_id, SUM(e.amount) amt FROM expenses e WHERE e.status = 'APPROVED' AND e.currency = ${REPORTING_CURRENCY}
                 AND e.expense_date BETWEEN ${period.from}::date AND ${period.to}::date AND ${NOT_DUPLICATE} GROUP BY 1) e ON e.branch_id = b.id
    LEFT JOIN (SELECT i.branch_id, SUM(i.grand_total) amt FROM invoices i WHERE i.status IN ('APPROVED','PARTIALLY_PAID','PAID') AND i.currency = ${REPORTING_CURRENCY}
                 AND i.invoice_date BETWEEN ${period.from}::date AND ${period.to}::date GROUP BY 1) i ON i.branch_id = b.id
    WHERE (${branchIds && branchIds.length ? branchIds : null}::uuid[] IS NULL OR b.id = ANY(${branchIds && branchIds.length ? branchIds : null}::uuid[]))
    ORDER BY (COALESCE(e.amt, 0) + COALESCE(i.amt, 0)) DESC, b.name`;
}

/** Percent change, or null when there is no meaningful baseline (never invent a trend). */
export function percentChange(current: string, previous: string): { pct: string; direction: "up" | "down" | "flat" } | null {
  const p = dec(previous);
  if (p.isZero()) return null;
  const change = dec(current).minus(p).dividedBy(p).times(100);
  return { pct: change.abs().toDecimalPlaces(1).toString(), direction: change.isZero() ? "flat" : change.isPositive() ? "up" : "down" };
}
