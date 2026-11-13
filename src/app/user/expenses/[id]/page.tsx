import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader, STATUS_TONE } from "@/components/ui/primitives";
import { Alert } from "@/components/ui/form";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { StatusHistory } from "@/components/expenses/status-history";
import { AttachmentList } from "@/components/expenses/attachment-list";
import { requireActor } from "@/server/auth/session";
import { loadSubject } from "@/server/authz/subject";
import { expensePolicy } from "@/server/authz/policy";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { formatDay, formatMoney, toDateInput } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor("USER");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const subject = await loadSubject(actor);
  const e = await db.expense.findUnique({
    where: { id },
    include: {
      category: true,
      branch: { select: { name: true, code: true } },
      attachments: { orderBy: { uploadedAt: "asc" } },
      history: { orderBy: { createdAt: "asc" }, include: { actor: { select: { fullName: true } } } },
    },
  });
  // Another user's expense is indistinguishable from a missing one.
  if (!e || !expensePolicy.view(subject, e)) {
    if (e) await audit({ actorId: actor.userId, actorRole: actor.role, action: "expense.view", entityType: "expense", entityId: id, outcome: "DENIED" });
    notFound();
  }

  const t = await getTranslations("expenses");
  const ts = await getTranslations("status");
  const locale = (await getLocale()) as AppLocale;
  const editable = expensePolicy.edit(subject, e);
  const categories = await db.expenseCategory.findMany({ where: { OR: [{ isActive: true }, { id: e.categoryId }] }, orderBy: { nameEn: "asc" } });
  const catName = (c: { nameEn: string; nameUr: string }) => (locale === "ur" ? c.nameUr : c.nameEn);

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow={<span className="ltr-data">{e.number}</span>}
        title={editable ? t("editTitle") : e.title}
        actions={<Badge tone={STATUS_TONE[e.status]}>{ts(e.status)}</Badge>}
      />
      {e.status === "REVISION_REQUESTED" && <Alert tone="warning" className="mb-5">{t("revisionBanner")}</Alert>}
      {e.reviewNote && e.status !== "APPROVED" && (
        <Alert tone={e.status === "REJECTED" ? "danger" : "info"} className="mb-5">
          <p className="font-medium">{t("reviewNote")}</p>
          <p className="mt-1 whitespace-pre-line">{e.reviewNote}</p>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-4 sm:p-6">
          {editable ? (
            <ExpenseForm
              categories={categories.map((c) => ({ id: c.id, name: catName(c) }))}
              existingAttachments={e.attachments.length}
              expense={{
                id: e.id,
                version: e.version,
                status: e.status,
                data: {
                  categoryId: e.categoryId,
                  title: e.title,
                  description: e.description ?? "",
                  amount: e.amount.toFixed(2),
                  currency: e.currency as "PKR",
                  expenseDate: toDateInput(e.expenseDate),
                  payeeName: e.payeeName ?? "",
                  paymentMethod: (e.paymentMethod ?? "") as "",
                  referenceNumber: e.referenceNumber ?? "",
                },
              }}
            />
          ) : (
            <>
              <Alert tone="info" className="mb-5">{t("locked")}</Alert>
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <Item label={t("amount")} value={<span className="tabular text-lg font-semibold">{formatMoney(e.amount, e.currency, locale)}</span>} />
                <Item label={t("date")} value={formatDay(e.expenseDate, locale)} />
                <Item label={t("category")} value={catName(e.category)} />
                <Item label={t("branch")} value={`${e.branch.name} (${e.branch.code})`} />
                <Item label={t("payee")} value={e.payeeName} />
                <Item label={t("paymentMethod")} value={e.paymentMethod ? t(`methods.${e.paymentMethod as "CASH"}`) : null} />
                <Item label={t("reference")} value={e.referenceNumber && <span className="ltr-data">{e.referenceNumber}</span>} />
                <Item label={t("description")} value={e.description && <span className="whitespace-pre-line">{e.description}</span>} wide />
              </dl>
            </>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title={t("attachments")} />
            <div className="p-5">
              <AttachmentList items={e.attachments} canRemove={editable} />
            </div>
          </Card>
          <Card>
            <CardHeader title={t("history")} />
            <div className="p-5">
              <StatusHistory items={e.history} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Item({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
