import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowUpRight, BarChart3, Building2, ClipboardCheck, Info, Landmark, Store, Wallet } from "lucide-react";
import { z } from "zod";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { MetricCard } from "@/components/ui/metric-card";
import { StaggerGrid } from "@/components/ui/stagger-grid";
import { AtelierBentoGrid, AtelierChartPanel } from "@/components/ui/atelier-card";
import { FilterBar } from "@/components/ui/filter-bar";
import { BarList, ColumnChart, StatusDonut, TrendChart } from "@/components/charts/charts";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { AuditTimeline } from "@/components/audit/audit-timeline";
import { ExportButton } from "@/components/admin/export-button";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { approvedTotals, monthlyTrend, percentChange, PERIOD_KEYS, REPORTING_CURRENCY, resolvePeriod, spendByBranch, spendByCategory } from "@/server/services/reporting-service";
import { dec } from "@/lib/finance/money";
import { intlLocale, type AppLocale } from "@/i18n/config";

const ALL_TIME = { from: new Date("2000-01-01T00:00:00Z"), to: new Date("2100-12-31T00:00:00Z") };
const IMPORTANT = ["registration.approved", "registration.rejected", "invoice.approved", "payment.recorded", "payment.corrected", "branch.created", "branch.deactivated", "account.suspended", "data.exported", "invoice.branch_violation", "expense.view"];

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireActor("SUPER_ADMIN");
  const sp = await searchParams;
  const periodKey = z.enum(PERIOD_KEYS).catch("last12").parse(sp.period ?? "last12");
  const branch = z.string().uuid().optional().catch(undefined).parse(sp.branch);
  const branchIds = branch ? [branch] : undefined;
  const t = await getTranslations("adminDash");
  const ts = await getTranslations("status");
  const tn = await getTranslations("nav");
  const locale = (await getLocale()) as AppLocale;
  const { current, previous } = resolvePeriod(periodKey);

  const [allTime, cur, prev, trend, byBranch, byCategory, pendingE, pendingI, outstanding, activeBranches, activeVendors, pendingRegs, invStatus, recentE, recentI, activity, branches] =
    await Promise.all([
      approvedTotals(ALL_TIME, branchIds),
      approvedTotals(current, branchIds),
      approvedTotals(previous, branchIds),
      monthlyTrend(current, branchIds),
      spendByBranch(current, branchIds),
      spendByCategory(current, branchIds),
      db.expense.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, ...(branch ? { branchId: branch } : {}) } }),
      db.invoice.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, ...(branch ? { branchId: branch } : {}) } }),
      db.$queryRaw<{ amount: string; count: number }[]>`SELECT COALESCE(SUM(grand_total - amount_paid),0)::text AS amount, COUNT(*)::int AS count FROM invoices
        WHERE status IN ('APPROVED','PARTIALLY_PAID') AND currency = ${REPORTING_CURRENCY} AND (${branch ?? null}::uuid IS NULL OR branch_id = ${branch ?? null}::uuid)`,
      db.branch.count({ where: { status: "ACTIVE" } }),
      db.vendorProfile.count({ where: { user: { status: "ACTIVE" }, branchAssignments: { some: { removedAt: null } } } }),
      db.registrationRequest.count({ where: { status: "PENDING", user: { status: "PENDING_APPROVAL" } } }),
      db.invoice.groupBy({ by: ["status"], _count: true, where: { status: { not: "DRAFT" }, ...(branch ? { branchId: branch } : {}) } }),
      db.expense.findMany({ where: { status: { not: "DRAFT" }, ...(branch ? { branchId: branch } : {}) }, orderBy: { submittedAt: "desc" }, take: 5, include: { category: { select: { nameEn: true, nameUr: true } }, owner: { select: { fullName: true } }, branch: { select: { name: true, code: true } }, _count: { select: { attachments: true } } } }),
      db.invoice.findMany({ where: { status: { not: "DRAFT" }, ...(branch ? { branchId: branch } : {}) }, orderBy: { submittedAt: "desc" }, take: 5, include: { branch: { select: { name: true, code: true } }, vendor: { select: { businessName: true } } } }),
      db.auditLog.findMany({ where: { action: { in: IMPORTANT } }, orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { fullName: true } } } }),
      db.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    ]);

  const change = percentChange(cur.total, prev.total);
  const monthFmt = new Intl.DateTimeFormat(intlLocale[locale], { month: "short", year: "2-digit", timeZone: "UTC" });
  const trendData = trend.map((p) => ({ label: monthFmt.format(new Date(`${p.month}-01T00:00:00Z`)), employee: Number(p.employee), vendor: Number(p.vendor) }));
  const hasTrend = trend.some((p) => !dec(p.employee).isZero() || !dec(p.vendor).isZero());
  const catTotal = byCategory.reduce((a, c) => a.plus(dec(c.total)), dec(0));
  const count = (...s: string[]) => invStatus.filter((x) => s.includes(x.status)).reduce((a, x) => a + x._count, 0);
  const o = outstanding[0] ?? { amount: "0", count: 0 };
  const branchData = byBranch.filter((b) => !dec(b.total).isZero()).slice(0, 12).map((b) => ({ label: b.code, value: Number(b.total) }));
  const qs = new URLSearchParams({ from: current.from.toISOString().slice(0, 10), to: current.to.toISOString().slice(0, 10), ...(branch ? { branch } : {}) }).toString();

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={<ExportButton report="expenses" query={`${qs}&status=APPROVED`} />} />
      <FilterBar
        selects={[
          { name: "period", label: t("period"), value: periodKey, defaultValue: "last12", options: PERIOD_KEYS.map((k) => ({ value: k, label: t(`periods.${k}`) })) },
          { name: "branch", label: tn("branches"), value: branch ?? "", options: branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })) },
        ]}
      />

      <StaggerGrid className="atelier-executive-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard className="atelier-metric-featured" label={t("totalApproved")} value={allTime.total} currency={REPORTING_CURRENCY} icon={<Landmark />} footnote={t("description")} />
        <MetricCard
          label={`${t("periodSpending")} · ${t(`periods.${periodKey}`)}`}
          value={cur.total}
          sparkline={trendData.map(p=>p.employee+p.vendor)}
          currency={REPORTING_CURRENCY}
          icon={<BarChart3 />}
          tone="info"
          footnote={change ? <span className={change.direction === "up" ? "text-copper" : change.direction === "down" ? "text-success" : ""}>{t("vsPrevious", { direction: change.direction, pct: change.pct })}</span> : t("noComparison")}
        />
        <MetricCard label={t("pendingApprovals")} value={String(pendingE + pendingI)} icon={<ClipboardCheck />} tone="warning" footnote={t("pendingBreakdown", { expenses: pendingE, invoices: pendingI })} />
        <MetricCard label={t("outstanding")} value={o.amount} currency={REPORTING_CURRENCY} icon={<Wallet />} tone="copper" footnote={`${o.count} ${tn("invoices")}`} />
        <MetricCard label={t("activeBranches")} value={String(activeBranches)} icon={<Building2 />} tone="success" />
        <MetricCard label={t("activeVendors")} value={String(activeVendors)} icon={<Store />} footnote={<Link href="/admin/registrations" className="hover:text-brand">{t("pendingRegistrations", { count: pendingRegs })}</Link>} />
      </StaggerGrid>

      <AtelierBentoGrid className="mt-6">
        <AtelierChartPanel>
          <CardHeader title={t("trend")} description={t(`periods.${periodKey}`)} />
          <div className="p-5">
            {hasTrend ? (
              <TrendChart caption={t("trendCaption")} currency={REPORTING_CURRENCY} data={trendData} series={[{ key: "employee", label: t("employeeSeries") }, { key: "vendor", label: t("vendorSeries") }]} />
            ) : (
              <EmptyState icon={BarChart3} title={t("notEnoughData")} body={t("notEnoughDataBody")} />
            )}
          </div>
        </AtelierChartPanel>
        <Card>
          <CardHeader title={t("byCategory")} description={t("employeeSeries")} />
          <div className="p-5">
            {byCategory.length ? (
              <BarList caption={t("byCategory")} currency={REPORTING_CURRENCY} data={byCategory.map((c) => ({ label: locale === "ur" ? c.nameUr : c.nameEn, value: c.total, share: catTotal.isZero() ? 0 : Number(dec(c.total).dividedBy(catTotal).toFixed(4)) }))} />
            ) : (
              <EmptyState icon={BarChart3} title={t("notEnoughData")} className="py-8" />
            )}
          </div>
        </Card>
      </AtelierBentoGrid>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title={t("byBranch")} action={<Link href="/admin/reports?type=branch" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">{t("viewAll")} <ArrowUpRight className="size-3.5 rtl:-scale-x-100" /></Link>} />
          <div className="p-5">
            {branchData.length ? <ColumnChart caption={t("byBranch")} currency={REPORTING_CURRENCY} data={branchData} /> : <EmptyState icon={Building2} title={t("notEnoughData")} className="py-8" />}
          </div>
        </Card>
        <Card>
          <CardHeader title={t("invoiceStatus")} />
          <div className="p-5">
            <StatusDonut
              caption={t("invoiceStatus")}
              centerLabel={tn("invoices")}
              centerValue={String(count("SUBMITTED", "UNDER_REVIEW", "APPROVED", "PARTIALLY_PAID", "PAID", "REJECTED", "REVISION_REQUESTED"))}
              data={[
                { key: "r", label: `${ts("SUBMITTED")} / ${ts("UNDER_REVIEW")}`, value: count("SUBMITTED", "UNDER_REVIEW"), color: "var(--warning)" },
                { key: "a", label: ts("APPROVED"), value: count("APPROVED"), color: "var(--info)" },
                { key: "pp", label: ts("PARTIALLY_PAID"), value: count("PARTIALLY_PAID"), color: "var(--copper)" },
                { key: "p", label: ts("PAID"), value: count("PAID"), color: "var(--success)" },
                { key: "x", label: `${ts("REJECTED")} / ${ts("REVISION_REQUESTED")}`, value: count("REJECTED", "REVISION_REQUESTED"), color: "var(--danger)" },
              ]}
            />
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title={t("recentExpenses")} action={<Link href="/admin/expenses" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">{t("viewAll")} <ArrowUpRight className="size-3.5 rtl:-scale-x-100" /></Link>} />
          {recentE.length ? <ExpenseTable rows={recentE} showOwner href={(id) => `/admin/expenses?id=${id}`} /> : <EmptyState icon={ClipboardCheck} title={t("notEnoughData")} className="py-8" />}
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title={t("recentInvoices")} action={<Link href="/admin/invoices" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">{t("viewAll")} <ArrowUpRight className="size-3.5 rtl:-scale-x-100" /></Link>} />
          {recentI.length ? <InvoiceTable rows={recentI} showVendor href={(id) => `/admin/invoices/${id}`} /> : <EmptyState icon={Store} title={t("notEnoughData")} className="py-8" />}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title={t("recentActivity")} action={<Link href="/admin/audit-logs" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">{t("viewAll")} <ArrowUpRight className="size-3.5 rtl:-scale-x-100" /></Link>} />
          <div className="p-5">{activity.length ? <AuditTimeline items={activity} /> : <p className="text-sm text-muted">{t("notEnoughData")}</p>}</div>
        </Card>
        <Card className="h-fit">
          <div className="flex gap-3 p-5">
            <Info className="mt-0.5 size-4 shrink-0 text-info" />
            <div>
              <p className="text-sm font-semibold">{t("definitions")}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t("definitionsBody")}</p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
