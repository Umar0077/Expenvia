import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, Paperclip } from "lucide-react";
import { Badge, STATUS_TONE, Table, Td, Th, Tr } from "@/components/ui/primitives";
import { formatDay, formatMoney } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export interface ExpenseRow {
  id: string;
  number: string;
  title: string;
  amount: { toString(): string };
  currency: string;
  expenseDate: Date;
  status: string;
  category: { nameEn: string; nameUr: string };
  branch?: { name: string; code: string };
  owner?: { fullName: string };
  _count?: { attachments: number };
}

/** Table on ≥md, stacked record cards on mobile. Amounts are end-aligned tabular figures. */
export async function ExpenseTable({ rows, href, showOwner }: { rows: ExpenseRow[]; href: (id: string) => string; showOwner?: boolean }) {
  const t = await getTranslations("expenses");
  const ts = await getTranslations("status");
  const locale = (await getLocale()) as AppLocale;
  const cat = (c: ExpenseRow["category"]) => (locale === "ur" ? c.nameUr : c.nameEn);

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>{t("number")}</Th>
              <Th>{t("titleField")}</Th>
              {showOwner && <Th>{t("owner")}</Th>}
              <Th>{t("date")}</Th>
              <Th>{t("status")}</Th>
              <Th num>{t("amount")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <Tr key={e.id}>
                <Td className="ltr-data whitespace-nowrap text-sm text-muted">{e.number}</Td>
                <Td>
                  <Link href={href(e.id)} className="font-medium hover:text-brand">{e.title}</Link>
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    {cat(e.category)}
                    {e.branch && <> · {e.branch.name}</>}
                    {!!e._count?.attachments && <Paperclip className="size-3" aria-label={t("attachments")} />}
                  </p>
                </Td>
                {showOwner && <Td className="text-sm">{e.owner?.fullName}</Td>}
                <Td className="whitespace-nowrap text-sm">{formatDay(e.expenseDate, locale)}</Td>
                <Td><Badge tone={STATUS_TONE[e.status]}>{ts(e.status as "DRAFT")}</Badge></Td>
                <Td num className="whitespace-nowrap font-semibold" ><span dir="ltr">{formatMoney(e.amount, e.currency, locale)}</span></Td>
                <Td className="w-10 text-end">
                  <Link href={href(e.id)} aria-label={`${t("view")} ${e.number}`} className="inline-grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text">
                    <ChevronRight className="size-4 rtl:-scale-x-100" />
                  </Link>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
      <ul className="md:hidden">
        {rows.map((e) => (
          <li key={e.id}>
            <Link href={href(e.id)} className="atelier-record active:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{e.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  <span className="ltr-data">{e.number}</span> · {formatDay(e.expenseDate, locale)}
                </p>
                {showOwner && <p className="text-xs text-muted">{e.owner?.fullName}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">{cat(e.category)}{e.branch&&<> · {e.branch.name}</>}{!!e._count?.attachments&&<Paperclip className="size-3.5" aria-label={t("attachments")}/>}</p>
              </div>
              <div className="record-top">
                <p className="record-amount tabular" dir="ltr">{formatMoney(e.amount, e.currency, locale)}</p>
                <Badge tone={STATUS_TONE[e.status]} className="mt-1">{ts(e.status as "DRAFT")}</Badge>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
