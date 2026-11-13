import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowUpRight, ClipboardCheck, FileText } from "lucide-react";
import { z } from "zod";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ApprovalQueue } from "@/components/expenses/approval-queue";
import { ExpenseReviewPanel } from "@/components/expenses/expense-review-panel";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { markUnderReview } from "@/server/services/expense-service";
import { formatDay, formatMoney } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor("SUPER_ADMIN");
  const sp = await searchParams;
  const selectedId = z.string().uuid().safeParse(sp.id).data;
  const t = await getTranslations("approvals");
  const ts = await getTranslations("status");
  const locale = (await getLocale()) as AppLocale;

  if (selectedId) await markUnderReview(actor, selectedId);

  const [pending, invoicesPending] = await Promise.all([
    db.expense.findMany({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      orderBy: { submittedAt: "asc" },
      take: 100,
      include: { owner: { select: { fullName: true } }, branch: { select: { name: true } }, _count: { select: { attachments: true } } },
    }),
    db.invoice.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
  ]);
  const active = selectedId ?? pending[0]?.id;

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {invoicesPending > 0 && (
        <Link href="/admin/invoices?status=SUBMITTED" className="mb-5 flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-copper/30 bg-copper-soft px-4 py-3 text-sm transition-colors hover:border-copper/60">
          <span className="flex items-center gap-2.5"><FileText className="size-4 text-copper" /> {t("pendingInvoices")}: <b className="tabular">{invoicesPending}</b></span>
          <span className="flex items-center gap-1 font-medium text-copper">{t("goInvoices")} <ArrowUpRight className="size-4 rtl:-scale-x-100" /></span>
        </Link>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_480px]">
        <Card className="h-fit overflow-hidden">
          <CardHeader title={t("queue")} action={<span className="tabular rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">{pending.length}</span>} />
          {pending.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title={t("empty")} body={t("emptyBody")} />
          ) : (
            <ApprovalQueue
              selectedId={active}
              statusLabels={{ SUBMITTED: ts("SUBMITTED"), UNDER_REVIEW: ts("UNDER_REVIEW") }}
              items={pending.map((e) => ({
                id: e.id,
                number: e.number,
                title: e.title,
                owner: e.owner.fullName,
                branch: e.branch.name,
                amount: e.amount.toFixed(2),
                currency: e.currency,
                amountLabel: formatMoney(e.amount, e.currency, locale),
                dateLabel: formatDay(e.expenseDate, locale),
                status: e.status,
                attachments: e._count.attachments,
              }))}
            />
          )}
        </Card>
        <div className="xl:sticky xl:top-[calc(var(--header-h)+24px)] xl:h-fit">
          {active ? <ExpenseReviewPanel id={active} /> : null}
        </div>
      </div>
    </>
  );
}
