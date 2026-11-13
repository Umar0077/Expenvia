import { getLocale, getTranslations } from "next-intl/server";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, STATUS_TONE, Table, Td, Th, Tr } from "@/components/ui/primitives";
import { formatAmount, formatDay, formatMoney, formatNumber } from "@/lib/format";
import { dec } from "@/lib/finance/money";
import type { AppLocale } from "@/i18n/config";
import type { loadInvoiceForDocument } from "@/server/invoice-document";

type Inv = NonNullable<Awaited<ReturnType<typeof loadInvoiceForDocument>>>;

export async function InvoiceSummaryCard({ inv }: { inv: Inv }) {
  const t = await getTranslations("invoices");
  const ts = await getTranslations("status");
  const locale = (await getLocale()) as AppLocale;
  const m = (v: { toString(): string }) => formatMoney(v, inv.currency, locale);
  const payable = ["APPROVED", "PARTIALLY_PAID", "PAID"].includes(inv.status);
  const outstanding = dec(inv.grandTotal.toString()).minus(dec(inv.amountPaid.toString()));
  const pct = payable && !inv.grandTotal.isZero() ? Math.min(100, Math.round((Number(inv.amountPaid) / Number(inv.grandTotal)) * 100)) : 0;
  const isDraft = inv.number.startsWith("DRAFT-");

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-surface-2/40 p-5">
        <div className="min-w-0">
          <p className="text-xs text-muted">{t("number")}</p>
          <p className="ltr-data mt-0.5 text-lg font-semibold">{isDraft ? t("draftNumber") : inv.number}</p>
          <p className="mt-1 text-sm text-muted">{inv.vendor.businessName} → {inv.branch.name} <span className="ltr-data">({inv.branch.code})</span></p>
        </div>
        <div className="text-end">
          <Badge tone={STATUS_TONE[inv.status]}>{ts(inv.status)}</Badge>
          <p className="tabular mt-2 text-[1.6rem] font-semibold leading-none" dir="ltr">{m(inv.grandTotal)}</p>
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-muted">{t("invoiceDate")}</dt><dd className="font-medium">{formatDay(inv.invoiceDate, locale)}</dd></div>
        <div><dt className="text-xs text-muted">{t("supplyDate")}</dt><dd className="font-medium">{inv.supplyDate ? formatDay(inv.supplyDate, locale) : "—"}</dd></div>
        <div><dt className="text-xs text-muted">{t("dueDate")}</dt><dd className="font-medium">{inv.dueDate ? formatDay(inv.dueDate, locale) : "—"}</dd></div>
      </dl>
      {payable && (
        <div className="border-t border-border px-5 py-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted">{t("amountPaid")}: <b className="tabular text-text" dir="ltr">{m(inv.amountPaid)}</b></span>
            <span className="text-muted">{t("outstanding")}: <b className="tabular text-copper" dir="ltr">{formatMoney(outstanding.toFixed(2), inv.currency, locale)}</b></span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("paymentProgress", { percent: pct })}>
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-[color-mix(in_oklab,var(--brand)_70%,var(--copper))] transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-end text-xs text-muted">{t("paymentProgress", { percent: pct })}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3.5">
        <Button asChild variant="secondary" size="sm"><a href={`/api/invoices/${inv.id}/document?format=pdf&lang=en`}><Download /> {t("downloadPdf")}</a></Button>
        <Button asChild variant="ghost" size="sm"><a href={`/api/invoices/${inv.id}/document?format=pdf&lang=ur`}><Download /> {t("downloadPdfUrdu")}</a></Button>
        <Button asChild variant="ghost" size="sm"><a href={`/api/invoices/${inv.id}/document?format=html&lang=${locale}`} target="_blank" rel="noopener"><FileText /> {t("preview")}</a></Button>
      </div>
    </Card>
  );
}

export async function InvoiceLines({ inv }: { inv: Inv }) {
  const t = await getTranslations("invoices");
  const locale = (await getLocale()) as AppLocale;
  const m = (v: { toString(): string }) => formatMoney(v, inv.currency, locale);
  return (
    <Card className="overflow-hidden">
      <CardHeader title={t("lineItems")} />
      <Table>
        <thead>
          <tr>
            <Th className="w-10">#</Th>
            <Th>{t("itemName")}</Th>
            <Th num>{t("quantity")}</Th>
            <Th num>{t("unitPrice")}</Th>
            <Th num className="hidden sm:table-cell">{t("taxRate")}</Th>
            <Th num className="hidden sm:table-cell">{t("discount")}</Th>
            <Th num>{t("lineTotal")}</Th>
          </tr>
        </thead>
        <tbody>
          {inv.lineItems.map((l) => (
            <Tr key={l.id}>
              <Td className="text-muted">{l.position}</Td>
              <Td>
                {/* Vendor-provided text is shown exactly as submitted (never translated). */}
                <p className="font-medium" dir="auto">{l.itemName}</p>
                {l.description && <p className="text-xs text-muted" dir="auto">{l.description}</p>}
              </Td>
              <Td num><span dir="ltr">{formatNumber(l.quantity, locale)} {l.unit}</span></Td>
              <Td num><span dir="ltr">{formatAmount(l.unitPrice, locale, 4)}</span></Td>
              <Td num className="hidden sm:table-cell">{l.taxRate.isZero() ? "—" : `${formatNumber(l.taxRate, locale, 2)}%`}</Td>
              <Td num className="hidden sm:table-cell">{l.discount.isZero() ? "—" : <span dir="ltr">{formatAmount(l.discount, locale)}</span>}</Td>
              <Td num className="font-semibold"><span dir="ltr">{m(l.lineTotal)}</span></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <dl className="ms-auto w-full max-w-xs space-y-1.5 border-t border-border p-5 text-sm">
        <div className="flex justify-between"><dt className="text-muted">{t("subtotal")}</dt><dd className="tabular" dir="ltr">{m(inv.subtotal)}</dd></div>
        {!inv.discountTotal.isZero() && <div className="flex justify-between"><dt className="text-muted">{t("discountTotal")}</dt><dd className="tabular" dir="ltr">− {m(inv.discountTotal)}</dd></div>}
        {!inv.taxTotal.isZero() && <div className="flex justify-between"><dt className="text-muted">{t("taxTotal")}</dt><dd className="tabular" dir="ltr">{m(inv.taxTotal)}</dd></div>}
        <div className="flex justify-between border-t border-border-strong pt-2 text-base font-semibold"><dt>{t("grandTotal")}</dt><dd className="tabular text-brand" dir="ltr">{m(inv.grandTotal)}</dd></div>
      </dl>
      {(inv.notes || inv.paymentTerms) && (
        <div className="grid gap-4 border-t border-border p-5 text-sm sm:grid-cols-2">
          {inv.notes && <div><p className="text-xs text-muted">{t("notes")}</p><p className="mt-0.5 whitespace-pre-line" dir="auto">{inv.notes}</p></div>}
          {inv.paymentTerms && <div><p className="text-xs text-muted">{t("paymentTerms")}</p><p className="mt-0.5 whitespace-pre-line" dir="auto">{inv.paymentTerms}</p></div>}
        </div>
      )}
    </Card>
  );
}
