import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowUpRight, Banknote, CheckCircle2, Clock3, FileText, Plus, Wallet } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { MetricCard } from "@/components/ui/metric-card";
import { StaggerGrid } from "@/components/ui/stagger-grid";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusDonut } from "@/components/charts/charts";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { requireActor } from "@/server/auth/session";
import { loadSubject } from "@/server/authz/subject";
import { db } from "@/server/db";
import { REPORTING_CURRENCY } from "@/server/services/reporting-service";
import { formatDay, formatMoney } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export default async function VendorDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor("VENDOR");
  const subject = await loadSubject(actor);
  const sp = await searchParams;
  const t = await getTranslations("vendorDash");
  const ti = await getTranslations("invoices");
  const ts = await getTranslations("status");
  const locale = (await getLocale()) as AppLocale;
  const vendorId = subject.vendorId ?? "00000000-0000-0000-0000-000000000000";
  const assigned = [...(subject.vendorBranchIds ?? [])];
  // Branch filter can only narrow to the vendor's OWN assigned branches.
  const branchParam = z.string().uuid().optional().catch(undefined).parse(sp.branch);
  const branch = branchParam && assigned.includes(branchParam) ? branchParam : undefined;
  const scope = { vendorId, ...(branch ? { branchId: branch } : {}) };

  const [byStatus, money, recent, payments, branches] = await Promise.all([
    db.invoice.groupBy({ by: ["status"], where: scope, _count: true }),
    db.$queryRaw<{ invoiced: string; approved: string; paid: string; outstanding: string }[]>`
      SELECT COALESCE(SUM(grand_total) FILTER (WHERE status <> 'DRAFT'), 0)::text AS invoiced,
             COALESCE(SUM(grand_total) FILTER (WHERE status IN ('APPROVED','PARTIALLY_PAID','PAID')), 0)::text AS approved,
             COALESCE(SUM(amount_paid), 0)::text AS paid,
             COALESCE(SUM(grand_total - amount_paid) FILTER (WHERE status IN ('APPROVED','PARTIALLY_PAID')), 0)::text AS outstanding
      FROM invoices WHERE vendor_id = ${vendorId}::uuid AND currency = ${REPORTING_CURRENCY}
        AND (${branch ?? null}::uuid IS NULL OR branch_id = ${branch ?? null}::uuid)`,
    db.invoice.findMany({ where: scope, orderBy: { updatedAt: "desc" }, take: 6, include: { branch: { select: { name: true, code: true } } } }),
    db.invoicePayment.findMany({ where: { invoice: scope }, orderBy: { createdAt: "desc" }, take: 5, include: { invoice: { select: { number: true, currency: true, id: true } } } }),
    db.branch.findMany({ where: { id: { in: assigned } }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
  ]);
  const count = (...s: string[]) => byStatus.filter((b) => s.includes(b.status)).reduce((a, b) => a + b._count, 0);
  const m = money[0] ?? { invoiced: "0", approved: "0", paid: "0", outstanding: "0" };
  const total = count("DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "PARTIALLY_PAID", "PAID", "REJECTED", "REVISION_REQUESTED");

  return (
    <>
      <PageHeader
        title={t("subtitle")}
        description={t("onlyYours")}
        actions={assigned.length > 0 && <Button asChild><Link href="/vendor/invoices/new"><Plus /> {ti("new")}</Link></Button>}
      />
      {branches.length > 1 && (
        <FilterBar selects={[{ name: "branch", label: t("branchFilter"), value: branch ?? "", options: branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })) }]} />
      )}
      <StaggerGrid className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t("totalInvoiced")} value={m.invoiced} currency={REPORTING_CURRENCY} icon={<FileText />} footnote={t("invoiceCount", { count: total - count("DRAFT") })} />
        <MetricCard label={t("pending")} value={String(count("SUBMITTED", "UNDER_REVIEW"))} icon={<Clock3 />} tone="warning" footnote={`${t("drafts")}: ${count("DRAFT")}`} />
        <MetricCard label={t("paid")} value={m.paid} currency={REPORTING_CURRENCY} icon={<CheckCircle2 />} tone="success" footnote={`${t("approved")}: ${formatMoney(m.approved, REPORTING_CURRENCY, locale)}`} />
        <MetricCard label={t("outstanding")} value={m.outstanding} currency={REPORTING_CURRENCY} icon={<Wallet />} tone="copper" />
      </StaggerGrid>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="h-fit overflow-hidden">
          <CardHeader title={t("recentInvoices")} action={<Link href="/vendor/invoices" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">{ti("title")} <ArrowUpRight className="size-3.5 rtl:-scale-x-100" /></Link>} />
          {recent.length === 0 ? <EmptyState icon={FileText} title={ti("empty")} body={assigned.length ? ti("emptyBody") : ti("noBranches")} /> : <InvoiceTable rows={recent} href={(id) => `/vendor/invoices/${id}`} />}
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title={t("statusChart")} />
            <div className="p-5">
              <StatusDonut
                caption={t("statusChart")}
                centerLabel={ti("title")}
                centerValue={String(total)}
                data={[
                  { key: "d", label: ts("DRAFT"), value: count("DRAFT"), color: "var(--border-strong)" },
                  { key: "r", label: t("pending"), value: count("SUBMITTED", "UNDER_REVIEW"), color: "var(--warning)" },
                  { key: "a", label: ts("APPROVED"), value: count("APPROVED"), color: "var(--info)" },
                  { key: "pp", label: ts("PARTIALLY_PAID"), value: count("PARTIALLY_PAID"), color: "var(--copper)" },
                  { key: "p", label: ts("PAID"), value: count("PAID"), color: "var(--success)" },
                  { key: "x", label: `${ts("REJECTED")} / ${ts("REVISION_REQUESTED")}`, value: count("REJECTED", "REVISION_REQUESTED"), color: "var(--danger)" },
                ]}
              />
            </div>
          </Card>
          <Card>
            <CardHeader title={t("assignedBranches")} />
            <div className="flex flex-wrap gap-2 p-5">
              {branches.length === 0 ? <p className="text-sm text-muted">{ti("noBranches")}</p> : branches.map((b) => <Badge key={b.id} tone="brand" dot={false} className="max-w-full whitespace-normal text-start">{b.name} · <span className="ltr-data">{b.code}</span></Badge>)}
            </div>
          </Card>
          <Card>
            <CardHeader title={t("paymentHistory")} />
            {payments.length === 0 ? (
              <EmptyState icon={Banknote} title={t("noPayments")} className="py-8" />
            ) : (
              <ul className="divide-y divide-border">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <Link href={`/vendor/invoices/${p.invoice.id}`} className="min-w-0">
                      <span className="ltr-data block truncate font-medium hover:text-brand">{p.invoice.number}</span>
                      <span className="text-xs text-muted">{formatDay(p.paymentDate, locale)}</span>
                    </Link>
                    <span className={`tabular font-semibold ${p.entryType === "CORRECTION" ? "text-danger" : "text-success"}`} dir="ltr">{formatMoney(p.amount, p.invoice.currency, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
