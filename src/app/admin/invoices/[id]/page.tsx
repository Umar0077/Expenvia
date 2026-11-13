import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardHeader, PageHeader, Table, Td, Th, Tr } from "@/components/ui/primitives";
import { Alert } from "@/components/ui/form";
import { InvoiceLines, InvoiceSummaryCard } from "@/components/invoices/invoice-view";
import { InvoiceReviewButtons, ReconcilePanel, RecordPaymentButton, ReversePaymentButton } from "@/components/invoices/admin-invoice-actions";
import { StatusHistory } from "@/components/expenses/status-history";
import { AuditTimeline } from "@/components/audit/audit-timeline";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { loadInvoiceForDocument } from "@/server/invoice-document";
import { markInvoiceUnderReview } from "@/server/services/invoice-service";
import { dec } from "@/lib/finance/money";
import { formatDay, formatMoney } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export default async function AdminInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor("SUPER_ADMIN");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  await markInvoiceUnderReview(actor, id);
  const inv = await loadInvoiceForDocument(id);
  if (!inv || inv.status === "DRAFT") notFound();

  const t = await getTranslations("invoices");
  const tp = await getTranslations("payments");
  const locale = (await getLocale()) as AppLocale;
  const m = (v: { toString(): string }) => formatMoney(v, inv.currency, locale);

  const [history, payments, audits, links, candidates] = await Promise.all([
    db.invoiceStatusHistory.findMany({ where: { invoiceId: id }, orderBy: { createdAt: "asc" }, include: { actor: { select: { fullName: true } } } }),
    db.invoicePayment.findMany({ where: { invoiceId: id }, orderBy: { createdAt: "asc" }, include: { recordedBy: { select: { fullName: true } }, correctedBy: { select: { id: true } } } }),
    db.auditLog.findMany({ where: { entityType: "invoice", entityId: id }, orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { fullName: true } } } }),
    db.financialReconciliation.findMany({ where: { invoiceId: id, unlinkedAt: null }, include: { expense: { select: { number: true, title: true } } } }),
    db.expense.findMany({
      where: { branchId: inv.branchId, status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] }, reconciliations: { none: { invoiceId: id, unlinkedAt: null } } },
      orderBy: { expenseDate: "desc" },
      take: 50,
      select: { id: true, number: true, title: true, amount: true, currency: true },
    }),
  ]);
  const reviewable = inv.status === "SUBMITTED" || inv.status === "UNDER_REVIEW";
  const payable = inv.status === "APPROVED" || inv.status === "PARTIALLY_PAID";
  const outstanding = dec(inv.grandTotal.toString()).minus(dec(inv.amountPaid.toString()));
  const versions = ((inv.snapshot as { versions?: unknown[] } | null)?.versions ?? []).length;

  return (
    <div className="max-w-7xl">
      <PageHeader eyebrow={<span className="ltr-data">{inv.number}</span>} title={inv.vendor.businessName} description={versions > 1 ? t("snapshotVersions", { count: versions }) : undefined} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <InvoiceSummaryCard inv={inv} />
          <InvoiceLines inv={inv} />
          <Card>
            <CardHeader title={t("auditTrail")} />
            <div className="p-5"><AuditTimeline items={audits} /></div>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Approval and payment are deliberately separate sections. */}
          <Card>
            <CardHeader title={t("approvalSection")} />
            <div className="space-y-4 p-5">
              {inv.reviewNote && <Alert tone="info"><p className="font-medium">{t("reviewNote")}</p><p className="mt-1 whitespace-pre-line">{inv.reviewNote}</p></Alert>}
              {reviewable && <InvoiceReviewButtons id={inv.id} number={inv.number} amount={m(inv.grandTotal)} />}
              <StatusHistory items={history} />
            </div>
          </Card>

          <Card>
            <CardHeader title={t("paymentSection")} action={payable ? <RecordPaymentButton invoiceId={inv.id} currency={inv.currency} outstanding={outstanding.toFixed(2)} /> : undefined} />
            {!payable && payments.length === 0 && <p className="p-5 text-sm text-muted">{inv.status === "PAID" ? t("noPayments") : t("paymentNotYet")}</p>}
            {payments.length > 0 && (
              <Table>
                <thead><tr><Th>{tp("date")}</Th><Th num>{tp("amount")}</Th><Th /></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <Tr key={p.id}>
                      <Td>
                        <p className="text-sm">{formatDay(p.paymentDate, locale)}</p>
                        <p className="text-2xs text-muted">{p.entryType === "CORRECTION" ? t("correction") : p.method ?? ""} {p.reference && <span className="ltr-data">· {p.reference}</span>} · {t("recordedBy", { name: p.recordedBy.fullName })}</p>
                        {p.proofKey && <a className="text-2xs text-brand hover:underline" href={`/api/files/payment-proof/${p.id}?inline=1`} target="_blank" rel="noopener">{t("proof")}</a>}
                      </Td>
                      <Td num className={p.entryType === "CORRECTION" ? "text-danger" : p.correctedBy.length ? "text-muted line-through" : "font-semibold"}><span dir="ltr">{m(p.amount)}</span></Td>
                      <Td className="text-end">
                        {p.entryType === "PAYMENT" && p.correctedBy.length === 0 ? <ReversePaymentButton paymentId={p.id} amount={m(p.amount)} /> : p.correctedBy.length ? <span className="text-2xs text-muted">{t("reversed")}</span> : null}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title={t("linkedExpenses")} />
            <div className="p-5">
              <ReconcilePanel
                invoiceId={inv.id}
                links={links.map((l) => ({ id: l.id, type: l.type, label: `${l.expense.number} · ${l.expense.title}` }))}
                candidates={candidates.map((c) => ({ id: c.id, label: `${c.number} · ${c.title} · ${formatMoney(c.amount, c.currency, locale)}` }))}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
