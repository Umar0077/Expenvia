import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { FileBarChart } from "lucide-react";
import { z } from "zod";
import { Card, CardHeader, EmptyState, PageHeader, Table, Td, Th, Tr } from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/filter-bar";
import { ExportButton } from "@/components/admin/export-button";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { buildReport, REPORT_TYPES } from "@/server/services/report-builder";
import { REPORTING_CURRENCY, resolvePeriod } from "@/server/services/reporting-service";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AppLocale } from "@/i18n/config";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireActor("SUPER_ADMIN");
  const sp = await searchParams;
  const type = z.enum(REPORT_TYPES).catch("summary").parse(sp.type ?? "summary");
  const branchId = z.string().uuid().optional().catch(undefined).parse(sp.branch);
  const vendorId = z.string().uuid().optional().catch(undefined).parse(sp.vendor);
  const def = resolvePeriod("ytd").current;
  const from = date.parse(sp.from) ?? def.from.toISOString().slice(0, 10);
  const to = date.parse(sp.to) ?? def.to.toISOString().slice(0, 10);
  const t = await getTranslations("reports");
  const tn = await getTranslations("nav");
  const locale = (await getLocale()) as AppLocale;

  const [report, branches, vendors] = await Promise.all([
    buildReport(type, { period: { from: new Date(`${from}T00:00:00Z`), to: new Date(`${to}T00:00:00Z`) }, branchId, vendorId }),
    db.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    db.vendorProfile.findMany({ orderBy: { businessName: "asc" }, select: { id: true, businessName: true } }),
  ]);
  const label = (k: string) => (t.has(k as never) ? t(k as never) : k);
  const cell = (v: string | number | null, kind?: string, colKey?: string) => {
    if (v === null || v === undefined) return "";
    if (type === "summary" && colKey === "metric") return t(`metrics.${v}` as never);
    if (type === "summary" && colKey === "value") return String(v).includes(".") ? formatMoney(String(v), REPORTING_CURRENCY, locale) : String(v);
    if (type === "approval" && colKey === "type") return t(`metrics.${v}` as never);
    if (kind === "money") return formatMoney(String(v), REPORTING_CURRENCY, locale);
    if (kind === "percent") return `${v}%`;
    if (kind === "number" && v !== "—") return formatNumber(String(v), locale, 1);
    return String(v);
  };
  const qs = new URLSearchParams({ type, from, to, ...(branchId ? { branch: branchId } : {}), ...(vendorId ? { vendor: vendorId } : {}) }).toString();

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={<ExportButton report="report" query={qs} />} />
      <nav aria-label={t("type")} className="mb-4 flex gap-1 overflow-x-auto pb-1">
        {REPORT_TYPES.map((r) => (
          <Link
            key={r}
            href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v) as [string, string][]), type: r }).toString()}`}
            aria-current={r === type ? "page" : undefined}
            className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors", r === type ? "bg-brand text-brand-fg" : "border border-border bg-surface text-muted hover:text-text")}
          >
            {t(`types.${r}`)}
          </Link>
        ))}
      </nav>
      <FilterBar
        selects={[
          { name: "branch", label: tn("branches"), value: branchId ?? "", options: branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })) },
          ...(["vendor", "outstanding", "payments"].includes(type) ? [{ name: "vendor", label: t("vendor"), value: vendorId ?? "", options: vendors.map((v) => ({ value: v.id, label: v.businessName })) }] : []),
        ]}
        dates={type === "outstanding" ? [] : [{ name: "from", label: t("from"), value: from }, { name: "to", label: t("to"), value: to }]}
      />
      <Card className="overflow-hidden">
        <CardHeader title={t(`types.${type}`)} description={t("rows", { count: report.rows.length })} />
        {report.rows.length === 0 ? (
          <EmptyState icon={FileBarChart} title={t("empty")} />
        ) : (
          <Table>
            <thead>
              <tr>{report.columns.map((c) => <Th key={c.key} num={!!c.kind && c.kind !== "text"}>{label(c.key)}</Th>)}</tr>
            </thead>
            <tbody>
              {report.rows.map((r, i) => (
                <Tr key={i}>
                  {r.map((v, j) => {
                    const c = report.columns[j]!;
                    return <Td key={j} num={!!c.kind && c.kind !== "text"} className={j === 0 ? "font-medium" : ""}><span dir={c.kind ? "ltr" : "auto"}>{cell(v, c.kind, c.key)}</span></Td>;
                  })}
                </Tr>
              ))}
              {report.totals && (
                <tr className="bg-surface-2/60 font-semibold">
                  {report.totals.map((v, j) => <Td key={j} num={j > 0}>{j === 0 ? t("total") : <span dir="ltr">{cell(v, report.columns[j]!.kind)}</span>}</Td>)}
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
