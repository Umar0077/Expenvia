import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader, STATUS_TONE, Table, Td, Th, Tr } from "@/components/ui/primitives";
import { Alert } from "@/components/ui/form";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";
import { InvoiceLines, InvoiceSummaryCard } from "@/components/invoices/invoice-view";
import { StatusHistory } from "@/components/expenses/status-history";
import { requireActor } from "@/server/auth/session";
import { loadSubject } from "@/server/authz/subject";
import { invoicePolicy } from "@/server/authz/policy";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { loadInvoiceForDocument } from "@/server/invoice-document";
import { dec } from "@/lib/finance/money";
import { formatDay, formatMoney, toDateInput } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export default async function VendorInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor("VENDOR");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const subject = await loadSubject(actor);
  const inv = await loadInvoiceForDocument(id);
  if (!inv || !invoicePolicy.view(subject, inv)) {
    if (inv) await audit({ actorId: actor.userId, actorRole: actor.role, action: "invoice.view", entityType: "invoice", entityId: id, outcome: "DENIED" });
    notFound();
  }
  const t = await getTranslations("invoices");
  const tp = await getTranslations("payments");
  const ts = await getTranslations("status");
  const locale = (await getLocale()) as AppLocale;
  const editable = invoicePolicy.edit(subject, inv);
  const [history, payments, branches] = await Promise.all([
    db.invoiceStatusHistory.findMany({ where: { invoiceId: id }, orderBy: { createdAt: "asc" }, include: { actor: { select: { fullName: true } } } }),
    db.invoicePayment.findMany({ where: { invoiceId: id }, orderBy: { createdAt: "asc" } }),
    editable ? db.branch.findMany({ where: { id: { in: [...(subject.vendorBranchIds ?? [])] }, status: "ACTIVE" }, select: { id: true, name: true, code: true } }) : [],
  ]);

  return (
    <div className="max-w-7xl">
      <PageHeader
        eyebrow={<span className="ltr-data">{inv.number.startsWith("DRAFT-") ? t("draftNumber") : inv.number}</span>}
        title={editable ? t("editTitle") : t("title")}
        actions={<Badge tone={STATUS_TONE[inv.status]}>{ts(inv.status)}</Badge>}
      />
      {inv.status === "REVISION_REQUESTED" && <Alert tone="warning" className="mb-5">{t("revisionBanner")}</Alert>}
      {inv.reviewNote && !["APPROVED", "PARTIALLY_PAID", "PAID"].includes(inv.status) && (
        <Alert tone={inv.status === "REJECTED" ? "danger" : "info"} className="mb-5"><p className="font-medium">{t("reviewNote")}</p><p className="mt-1 whitespace-pre-line">{inv.reviewNote}</p></Alert>
      )}

      {editable ? (
        <InvoiceBuilder
          branches={branches}
          invoice={{
            id: inv.id,
            version: inv.version,
            status: inv.status,
            number: inv.number,
            data: {
              branchId: inv.branchId,
              currency: inv.currency as "PKR",
              invoiceDate: toDateInput(inv.invoiceDate),
              supplyDate: inv.supplyDate ? toDateInput(inv.supplyDate) : "",
              dueDate: inv.dueDate ? toDateInput(inv.dueDate) : "",
              notes: inv.notes ?? "",
              paymentTerms: inv.paymentTerms ?? "",
              paymentDetails: inv.paymentDetails ?? "",
              lines: inv.lineItems.map((l) => ({
                itemName: l.itemName,
                description: l.description ?? "",
                quantity: dec(l.quantity.toString()).toString(),
                unit: l.unit,
                unitPrice: dec(l.unitPrice.toString()).toString(),
                taxRate: dec(l.taxRate.toString()).toString(),
                discount: l.discount.toFixed(2),
              })),
            },
          }}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <InvoiceSummaryCard inv={inv} />
            <InvoiceLines inv={inv} />
          </div>
          <div className="space-y-5">
            <Card>
              <CardHeader title={t("payments")} />
              {payments.length === 0 ? (
                <p className="p-5 text-sm text-muted">{t("noPayments")}</p>
              ) : (
                <Table>
                  <thead><tr><Th>{tp("date")}</Th><Th>{tp("type")}</Th><Th num>{tp("amount")}</Th></tr></thead>
                  <tbody>
                    {payments.map((p) => (
                      <Tr key={p.id}>
                        <Td className="text-sm">{formatDay(p.paymentDate, locale)}</Td>
                        <Td className="text-sm">{tp(p.entryType)}</Td>
                        <Td num className={p.entryType === "CORRECTION" ? "text-danger" : "font-medium"}><span dir="ltr">{formatMoney(p.amount, inv.currency, locale)}</span></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
            <Card>
              <CardHeader title={t("history")} />
              <div className="p-5"><StatusHistory items={history} /></div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
