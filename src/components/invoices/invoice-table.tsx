import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { Badge, STATUS_TONE, Table, Td, Th, Tr } from "@/components/ui/primitives";
import { formatDay, formatMoney } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";
import { dec } from "@/lib/finance/money";

type D = { toString(): string };
export interface InvoiceRow {
  id: string;
  number: string;
  status: string;
  currency: string;
  invoiceDate: Date;
  dueDate: Date | null;
  grandTotal: D;
  amountPaid: D;
  branch: { name: string; code: string };
  vendor?: { businessName: string };
}

const PAYABLE = ["APPROVED", "PARTIALLY_PAID", "PAID"];

export async function InvoiceTable({ rows, href, showVendor }: { rows: InvoiceRow[]; href: (id: string) => string; showVendor?: boolean }) {
  const t = await getTranslations("invoices");
  const ts = await getTranslations("status");
  const locale = (await getLocale()) as AppLocale;
  const num = (r: InvoiceRow) => (r.number.startsWith("DRAFT-") ? t("draftNumber") : r.number);
  const outstanding = (r: InvoiceRow) => (PAYABLE.includes(r.status) ? dec(r.grandTotal.toString()).minus(dec(r.amountPaid.toString())) : null);
  const progress = (r: InvoiceRow) => (PAYABLE.includes(r.status) && !dec(r.grandTotal.toString()).isZero() ? Math.min(100, Math.round((Number(r.amountPaid.toString()) / Number(r.grandTotal.toString())) * 100)) : 0);

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>{t("number")}</Th>
              {showVendor && <Th>{t("vendor")}</Th>}
              <Th>{t("branch")}</Th>
              <Th>{t("invoiceDate")}</Th>
              <Th className="hidden xl:table-cell">{t("dueDate")}</Th>
              <Th>{t("status")}</Th>
              <Th num>{t("grandTotal")}</Th>
              <Th num>{t("outstanding")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const out = outstanding(r);
              return (
                <Tr key={r.id}>
                  <Td><Link href={href(r.id)} className="ltr-data whitespace-nowrap text-sm font-medium hover:text-brand">{num(r)}</Link></Td>
                  {showVendor && <Td className="font-medium">{r.vendor?.businessName}</Td>}
                  <Td className="text-sm">{r.branch.name} <span className="ltr-data text-xs text-muted">{r.branch.code}</span></Td>
                  <Td className="whitespace-nowrap text-sm">{formatDay(r.invoiceDate, locale)}</Td>
                  <Td className="hidden whitespace-nowrap text-sm text-muted xl:table-cell">{r.dueDate ? formatDay(r.dueDate, locale) : "—"}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[r.status]}>{ts(r.status as "DRAFT")}</Badge>
                    {PAYABLE.includes(r.status) && r.status !== "APPROVED" && (
                      <div className="mt-1.5 h-1 w-20 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={progress(r)} aria-valuemin={0} aria-valuemax={100} aria-label={t("paymentProgress", { percent: progress(r) })}>
                        <div className="h-full rounded-full bg-brand" style={{ width: `${progress(r)}%` }} />
                      </div>
                    )}
                  </Td>
                  <Td num className="whitespace-nowrap font-semibold"><span dir="ltr">{formatMoney(r.grandTotal, r.currency, locale)}</span></Td>
                  <Td num className="whitespace-nowrap">{out ? <span dir="ltr" className={out.isZero() ? "text-muted" : "text-copper"}>{formatMoney(out.toFixed(2), r.currency, locale)}</span> : <span className="text-muted">—</span>}</Td>
                  <Td className="w-10"><Link href={href(r.id)} aria-label={num(r)} className="inline-grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2"><ChevronRight className="size-4 rtl:-scale-x-100" /></Link></Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </div>
      <ul className="md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={href(r.id)} className="atelier-record active:bg-surface-2">
              <div className="record-top">
                <p className="ltr-data break-all text-sm font-semibold">{num(r)}</p>
                <Badge tone={STATUS_TONE[r.status]}>{ts(r.status as "DRAFT")}</Badge>
              </div>
              <p className="record-amount tabular" dir="ltr">{formatMoney(r.grandTotal, r.currency, locale)}</p>
              <p className="text-sm text-muted">{showVendor ? `${r.vendor?.businessName} · ` : ""}{r.branch.name}</p>
              <p className="text-xs text-muted">{t("invoiceDate")}: {formatDay(r.invoiceDate, locale)}{r.dueDate&&<> · {t("dueDate")}: {formatDay(r.dueDate, locale)}</>}</p>
              {PAYABLE.includes(r.status)&&<><div className="atelier-progress" role="progressbar" aria-valuenow={progress(r)} aria-valuemin={0} aria-valuemax={100} aria-label={t("paymentProgress",{percent:progress(r)})}><span style={{width:`${progress(r)}%`}}/></div><p className="text-xs text-muted">{t("outstanding")}: <bdi>{formatMoney(outstanding(r)!.toFixed(2),r.currency,locale)}</bdi></p></>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
