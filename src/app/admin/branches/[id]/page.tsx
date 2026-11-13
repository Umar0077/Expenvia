import { notFound } from "next/navigation";
import { BranchContact } from "@/components/admin/branch-contact";
import { getLocale, getTranslations } from "next-intl/server";
import { BarChart3, Building2, Clock3, Mail, MapPin, Phone, Receipt, Store, User, Wallet } from "lucide-react";
import { z } from "zod";
import { Badge, Card, CardHeader, EmptyState, PageHeader, STATUS_TONE, Table, Td, Th, Tr } from "@/components/ui/primitives";
import { MetricCard } from "@/components/ui/metric-card";
import { StaggerGrid } from "@/components/ui/stagger-grid";
import { FilterBar } from "@/components/ui/filter-bar";
import { BarList, ColumnChart, TrendChart } from "@/components/charts/charts";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { BranchFormButton, BranchStatusButton } from "@/components/admin/branch-controls";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { approvedTotals, monthlyTrend, PERIOD_KEYS, REPORTING_CURRENCY, resolvePeriod, spendByBranch, spendByCategory } from "@/server/services/reporting-service";
import { dec } from "@/lib/finance/money";
import { formatDate, formatMoney } from "@/lib/format";
import { intlLocale, type AppLocale } from "@/i18n/config";

export default async function BranchDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireActor("SUPER_ADMIN");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const branch = await db.branch.findUnique({ where: { id }, include: { createdBy: { select: { fullName: true } } } });
  if (!branch) notFound();
  const periodKey = z.enum(PERIOD_KEYS).catch("last12").parse(sp.period ?? "last12");
  const compareIds = (sp.compare ?? "").split(",").filter((s) => z.string().uuid().safeParse(s).success && s !== id).slice(0, 5);
  const { current } = resolvePeriod(periodKey);
  const t = await getTranslations("branchDetail");
  const tb = await getTranslations("branches");
  const td = await getTranslations("adminDash");
  const ts = await getTranslations("status");
  const locale = (await getLocale()) as AppLocale;

  const [totals, trend, cats, pending, outstanding, recent, vendorActivity, employees, compare, allBranches] = await Promise.all([
    approvedTotals(current, [id]),
    monthlyTrend(current, [id]),
    spendByCategory(current, [id]),
    Promise.all([db.expense.count({ where: { branchId: id, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }), db.invoice.count({ where: { branchId: id, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } })]),
    db.$queryRaw<{ amount: string }[]>`SELECT COALESCE(SUM(grand_total - amount_paid),0)::text AS amount FROM invoices WHERE branch_id = ${id}::uuid AND status IN ('APPROVED','PARTIALLY_PAID') AND currency = ${REPORTING_CURRENCY}`,
    db.expense.findMany({ where: { branchId: id, status: { not: "DRAFT" } }, orderBy: { submittedAt: "desc" }, take: 6, include: { category: { select: { nameEn: true, nameUr: true } }, owner: { select: { fullName: true } }, _count: { select: { attachments: true } } } }),
    db.$queryRaw<{ vendor: string; count: number; total: string; status: string | null }[]>`
      SELECT v.business_name AS vendor, COUNT(i.id)::int AS count, COALESCE(SUM(i.grand_total) FILTER (WHERE i.status IN ('APPROVED','PARTIALLY_PAID','PAID')),0)::text AS total,
             (SELECT CASE WHEN a.removed_at IS NULL THEN 'ACTIVE' ELSE 'INACTIVE' END FROM vendor_branch_assignments a WHERE a.vendor_id = v.id AND a.branch_id = ${id}::uuid ORDER BY a.assigned_at DESC LIMIT 1) AS status
      FROM vendor_profiles v LEFT JOIN invoices i ON i.vendor_id = v.id AND i.branch_id = ${id}::uuid AND i.status <> 'DRAFT'
      WHERE EXISTS (SELECT 1 FROM vendor_branch_assignments a WHERE a.vendor_id = v.id AND a.branch_id = ${id}::uuid)
      GROUP BY v.id ORDER BY 3 DESC`,
    db.userBranchAssignment.findMany({ where: { branchId: id, endedAt: null }, include: { user: { select: { fullName: true, email: true, status: true } } }, orderBy: { startedAt: "asc" } }),
    compareIds.length ? spendByBranch(current, [id, ...compareIds]) : Promise.resolve([]),
    db.branch.findMany({ where: { id: { not: id } }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
  ]);
  const monthFmt = new Intl.DateTimeFormat(intlLocale[locale], { month: "short", year: "2-digit", timeZone: "UTC" });
  const hasTrend = trend.some((p) => !dec(p.employee).isZero() || !dec(p.vendor).isZero());
  const catTotal = cats.reduce((a, c) => a.plus(dec(c.total)), dec(0));

  return (
    <>
      <PageHeader
        eyebrow={<span className="ltr-data font-semibold text-copper">{branch.code}</span>}
        title={branch.name}
        description={<span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" /> {[branch.address, branch.city, branch.country].filter(Boolean).join(", ")}</span>}
        actions={
          <>
            <Badge tone={STATUS_TONE[branch.status]}>{ts(branch.status)}</Badge>
            <BranchFormButton branch={branch} />
            <BranchStatusButton id={branch.id} name={branch.name} status={branch.status} />
          </>
        }
      />
      <Card className="mb-5"><BranchContact branch={branch}/></Card>
      <FilterBar
        selects={[
          { name: "period", label: td("period"), value: periodKey, defaultValue: "last12", options: PERIOD_KEYS.map((k) => ({ value: k, label: td(`periods.${k}`) })) },
          { name: "compare", label: t("compare"), value: compareIds[0] ?? "", options: allBranches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })) },
        ]}
      />

      <StaggerGrid className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={`${td("periodSpending")} · ${td(`periods.${periodKey}`)}`} value={totals.total} currency={REPORTING_CURRENCY} icon={<BarChart3 />} />
        <MetricCard label={t("employeeTotal")} value={totals.employee} currency={REPORTING_CURRENCY} icon={<Receipt />} tone="info" />
        <MetricCard label={t("vendorTotal")} value={totals.vendor} currency={REPORTING_CURRENCY} icon={<Store />} tone="copper" />
        <MetricCard label={t("outstanding")} value={outstanding[0]?.amount ?? "0"} currency={REPORTING_CURRENCY} icon={<Wallet />} tone="warning" footnote={<span className="inline-flex items-center gap-1"><Clock3 className="size-3" /> {t("pending")}: {pending[0] + pending[1]}</span>} />
      </StaggerGrid>

      {compare.length > 0 && (
        <Card className="mt-5">
          <CardHeader title={t("compare")} description={t("compareHint")} />
          <div className="p-5"><ColumnChart caption={t("compare")} currency={REPORTING_CURRENCY} data={compare.map((c) => ({ label: c.code, value: Number(c.total) }))} /></div>
        </Card>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title={td("trend")} />
          <div className="p-5">
            {hasTrend ? (
              <TrendChart caption={td("trendCaption")} currency={REPORTING_CURRENCY} data={trend.map((p) => ({ label: monthFmt.format(new Date(`${p.month}-01T00:00:00Z`)), employee: Number(p.employee), vendor: Number(p.vendor) }))} series={[{ key: "employee", label: td("employeeSeries") }, { key: "vendor", label: td("vendorSeries") }]} />
            ) : (
              <EmptyState icon={BarChart3} title={td("notEnoughData")} body={td("notEnoughDataBody")} />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title={td("byCategory")} />
          <div className="p-5">
            {cats.length ? <BarList caption={td("byCategory")} currency={REPORTING_CURRENCY} data={cats.map((c) => ({ label: locale === "ur" ? c.nameUr : c.nameEn, value: c.total, share: catTotal.isZero() ? 0 : Number(dec(c.total).dividedBy(catTotal).toFixed(4)) }))} /> : <EmptyState icon={BarChart3} title={td("notEnoughData")} className="py-8" />}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader title={t("recentExpenses")} />
          {recent.length ? <ExpenseTable rows={recent} showOwner href={(eid) => `/admin/expenses?id=${eid}`} /> : <EmptyState icon={Receipt} title={td("notEnoughData")} className="py-8" />}
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title={tb("info")} />
            <dl className="space-y-2.5 p-5 text-sm">
              {branch.managerName && <div className="flex items-center gap-2"><User className="size-4 text-muted" /> {branch.managerName}</div>}
              {branch.contactPhone && <div className="flex items-center gap-2"><Phone className="size-4 text-muted" /> <span className="ltr-data">{branch.contactPhone}</span></div>}
              {branch.contactEmail && <div className="flex items-center gap-2"><Mail className="size-4 text-muted" /> <span className="ltr-data">{branch.contactEmail}</span></div>}
              <p className="pt-1 text-xs text-muted">{tb("createdBy", { name: branch.createdBy.fullName, date: formatDate(branch.createdAt, locale) })}</p>
            </dl>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title={t("vendorActivity")} />
            {vendorActivity.length === 0 ? <EmptyState icon={Store} title={tb("vendors", { count: 0 })} className="py-8" /> : (
              <Table>
                <tbody>
                  {vendorActivity.map((v) => (
                    <Tr key={v.vendor}>
                      <Td><p className="font-medium">{v.vendor}</p><p className="text-xs text-muted">{v.count} · {ts((v.status ?? "INACTIVE") as "ACTIVE")}</p></Td>
                      <Td num><span dir="ltr">{formatMoney(v.total, REPORTING_CURRENCY, locale)}</span></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          <Card>
            <CardHeader title={t("employees")} />
            {employees.length === 0 ? <EmptyState icon={Building2} title={tb("employees", { count: 0 })} className="py-8" /> : (
              <ul className="divide-y divide-border">
                {employees.map((e) => (
                  <li key={e.id} className="px-5 py-2.5 text-sm"><p className="font-medium">{e.user.fullName}</p><p className="ltr-data text-xs text-muted">{e.user.email}</p></li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
