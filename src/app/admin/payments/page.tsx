import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Banknote, CalendarCheck, FileClock, Wallet } from "lucide-react";
import { z } from "zod";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th, Tr } from "@/components/ui/primitives";
import { MetricCard } from "@/components/ui/metric-card";
import { StaggerGrid } from "@/components/ui/stagger-grid";
import { FilterBar } from "@/components/ui/filter-bar";
import { Pagination, PAGE_SIZE, pageFrom } from "@/components/ui/pagination";
import { ExportButton } from "@/components/admin/export-button";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { currentMonth, REPORTING_CURRENCY } from "@/server/services/reporting-service";
import { formatDay, formatMoney } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireActor("SUPER_ADMIN");
  const sp = await searchParams;
  const vendor = z.string().uuid().optional().catch(undefined).parse(sp.vendor);
  const page = pageFrom(sp);
  const t = await getTranslations("payments");
  const ti = await getTranslations("invoices");
  const locale = (await getLocale()) as AppLocale;
  const month = currentMonth();
  const where = vendor ? { invoice: { vendorId: vendor } } : {};

  const [ledger, total, awaiting, sums, vendors] = await Promise.all([
    db.invoicePayment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { invoice: { select: { id: true, number: true, currency: true, vendor: { select: { businessName: true } } } }, recordedBy: { select: { fullName: true } } },
    }),
    db.invoicePayment.count({ where }),
    db.invoice.findMany({
      where: { status: { in: ["APPROVED", "PARTIALLY_PAID"] }, ...(vendor ? { vendorId: vendor } : {}) },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
      take: 10,
      include: { vendor: { select: { businessName: true } }, branch: { select: { name: true } } },
    }),
    db.$queryRaw<{ outstanding: string; paid_month: string; awaiting: number }[]>`
      SELECT
        (SELECT COALESCE(SUM(grand_total - amount_paid),0) FROM invoices WHERE status IN ('APPROVED','PARTIALLY_PAID') AND currency = ${REPORTING_CURRENCY})::text AS outstanding,
        (SELECT COALESCE(SUM(p.amount),0) FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id
           WHERE i.currency = ${REPORTING_CURRENCY} AND p.payment_date BETWEEN ${month.from}::date AND ${month.to}::date)::text AS paid_month,
        (SELECT COUNT(*) FROM invoices WHERE status IN ('APPROVED','PARTIALLY_PAID'))::int AS awaiting`,
    db.vendorProfile.findMany({ orderBy: { businessName: "asc" }, select: { id: true, businessName: true } }),
  ]);
  const s = sums[0] ?? { outstanding: "0", paid_month: "0", awaiting: 0 };

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={<ExportButton report="payments" query={vendor ? `vendor=${vendor}` : ""} />} />
      <StaggerGrid className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard label={t("totalOutstanding")} value={s.outstanding} currency={REPORTING_CURRENCY} icon={<Wallet />} tone="copper" />
        <MetricCard label={t("paidThisMonth")} value={s.paid_month} currency={REPORTING_CURRENCY} icon={<CalendarCheck />} tone="success" />
        <MetricCard label={t("awaitingCount")} value={String(s.awaiting)} icon={<FileClock />} tone="warning" />
      </StaggerGrid>
      <FilterBar selects={[{ name: "vendor", label: t("vendor"), value: vendor ?? "", options: vendors.map((v) => ({ value: v.id, label: v.businessName })) }]} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="h-fit overflow-hidden">
          <CardHeader title={t("ledger")} />
          {ledger.length === 0 ? (
            <EmptyState icon={Banknote} title={t("empty")} />
          ) : (
            <>
              <Table>
                <thead><tr><Th>{t("date")}</Th><Th>{t("invoice")}</Th><Th className="hidden md:table-cell">{t("vendor")}</Th><Th>{t("type")}</Th><Th num>{t("amount")}</Th></tr></thead>
                <tbody>
                  {ledger.map((p) => (
                    <Tr key={p.id}>
                      <Td className="whitespace-nowrap text-sm">{formatDay(p.paymentDate, locale)}</Td>
                      <Td><Link href={`/admin/invoices/${p.invoice.id}`} className="ltr-data text-sm font-medium hover:text-brand">{p.invoice.number}</Link><p className="text-2xs text-muted">{ti("recordedBy", { name: p.recordedBy.fullName })}</p></Td>
                      <Td className="hidden text-sm md:table-cell">{p.invoice.vendor.businessName}</Td>
                      <Td><Badge tone={p.entryType === "CORRECTION" ? "danger" : "success"}>{t(p.entryType)}</Badge></Td>
                      <Td num className={p.entryType === "CORRECTION" ? "text-danger" : "font-semibold"}><span dir="ltr">{formatMoney(p.amount, p.invoice.currency, locale)}</span></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={page} total={total} sp={sp} />
            </>
          )}
        </Card>
        <Card className="h-fit overflow-hidden">
          <CardHeader title={t("outstandingTitle")} description={t("outstandingDescription")} />
          {awaiting.length === 0 ? (
            <EmptyState icon={Wallet} title={t("noOutstanding")} className="py-10" />
          ) : (
            <ul className="divide-y divide-border">
              {awaiting.map((i) => (
                <li key={i.id}>
                  <Link href={`/admin/invoices/${i.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2/60">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{i.vendor.businessName}</span>
                      <span className="block truncate text-xs text-muted"><span className="ltr-data">{i.number}</span> · {i.branch.name}{i.dueDate ? ` · ${formatDay(i.dueDate, locale)}` : ""}</span>
                    </span>
                    <span className="tabular shrink-0 font-semibold text-copper" dir="ltr">{formatMoney(i.grandTotal.minus(i.amountPaid), i.currency, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
