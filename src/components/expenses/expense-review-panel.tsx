import { getLocale, getTranslations } from "next-intl/server";
import { Badge, Card, STATUS_TONE } from "@/components/ui/primitives";
import { StatusHistory } from "@/components/expenses/status-history";
import { AttachmentList } from "@/components/expenses/attachment-list";
import { ExpenseDecisionButtons } from "@/components/expenses/expense-decision";
import { db } from "@/server/db";
import { formatDateTime, formatDay, formatMoney } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

/** Admin review panel: everything needed before deciding, shown up front. */
export async function ExpenseReviewPanel({ id }: { id: string }) {
  const e = await db.expense.findUnique({
    where: { id },
    include: {
      category: true,
      branch: { select: { name: true, code: true } },
      owner: { select: { fullName: true, email: true } },
      attachments: { orderBy: { uploadedAt: "asc" } },
      history: { orderBy: { createdAt: "asc" }, include: { actor: { select: { fullName: true } } } },
      reconciliations: { where: { unlinkedAt: null }, include: { invoice: { select: { number: true } } } },
    },
  });
  if (!e || e.status === "DRAFT") return null;
  const t = await getTranslations("expenses");
  const ts = await getTranslations("status");
  const locale = (await getLocale()) as AppLocale;
  const decidable = e.status === "SUBMITTED" || e.status === "UNDER_REVIEW";

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border bg-surface-2/40 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="ltr-data text-xs text-muted">{e.number}</p>
            <h2 className="mt-1 text-lg font-semibold">{e.title}</h2>
          </div>
          <Badge tone={STATUS_TONE[e.status]}>{ts(e.status)}</Badge>
        </div>
        <p className="tabular mt-3 text-[1.7rem] font-semibold" dir="ltr">{formatMoney(e.amount, e.currency, locale)}</p>
      </div>
      <dl className="grid gap-3 p-5 text-sm sm:grid-cols-2">
        <Row label={t("owner")} value={<>{e.owner.fullName}<span className="ltr-data block text-xs text-muted">{e.owner.email}</span></>} />
        <Row label={t("branch")} value={`${e.branch.name} (${e.branch.code})`} />
        <Row label={t("category")} value={locale === "ur" ? e.category.nameUr : e.category.nameEn} />
        <Row label={t("date")} value={formatDay(e.expenseDate, locale)} />
        <Row label={t("payee")} value={e.payeeName} />
        <Row label={t("paymentMethod")} value={e.paymentMethod ? t(`methods.${e.paymentMethod as "CASH"}`) : null} />
        <Row label={t("reference")} value={e.referenceNumber && <span className="ltr-data">{e.referenceNumber}</span>} />
        <Row label={t("submitted")} value={e.submittedAt && formatDateTime(e.submittedAt, locale)} />
        {e.description && <Row label={t("description")} value={<span className="whitespace-pre-line">{e.description}</span>} wide />}
        {e.reconciliations.map((r) => (
          <Row key={r.id} label="↔" value={<Badge tone="copper" dot={false}>{r.type} · <span className="ltr-data">{r.invoice.number}</span></Badge>} wide />
        ))}
      </dl>
      <div className="border-t border-border p-5">
        <h3 className="mb-3 text-sm font-semibold">{t("attachments")}</h3>
        <AttachmentList items={e.attachments} />
      </div>
      {decidable && (
        <div className="border-t border-border p-5">
          <ExpenseDecisionButtons id={e.id} number={e.number} amount={formatMoney(e.amount, e.currency, locale)} branch={e.branch.name} />
        </div>
      )}
      <div className="border-t border-border p-5">
        <h3 className="mb-3 text-sm font-semibold">{t("history")}</h3>
        <StatusHistory items={e.history} />
      </div>
    </Card>
  );
}

function Row({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
