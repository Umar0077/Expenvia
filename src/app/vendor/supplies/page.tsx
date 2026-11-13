import { getLocale, getTranslations } from "next-intl/server";
import { Package } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { Alert } from "@/components/ui/form";
import { SupplyForm, SupplyList } from "@/components/invoices/supply-controls";
import { requireActor } from "@/server/auth/session";
import { loadSubject } from "@/server/authz/subject";
import { db } from "@/server/db";
import { calculateLine } from "@/lib/finance/money";
import { formatDay, formatMoney, formatNumber } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export default async function SuppliesPage() {
  const actor = await requireActor("VENDOR");
  const subject = await loadSubject(actor);
  const t = await getTranslations("supplies");
  const ti = await getTranslations("invoices");
  const locale = (await getLocale()) as AppLocale;
  const [branches, records] = await Promise.all([
    db.branch.findMany({ where: { id: { in: [...(subject.vendorBranchIds ?? [])] }, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    db.vendorSupplyRecord.findMany({
      where: { vendorId: subject.vendorId ?? "00000000-0000-0000-0000-000000000000" },
      orderBy: [{ invoiceId: { sort: "asc", nulls: "first" } }, { supplyDate: "desc" }],
      take: 200,
      include: { branch: { select: { name: true, code: true } }, invoice: { select: { id: true, number: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={branches.length > 0 ? <SupplyForm branches={branches} /> : undefined} />
      {branches.length === 0 && <Alert tone="warning" className="mb-5">{ti("noBranches")}</Alert>}
      <Card className="overflow-hidden">
        {records.length === 0 ? (
          <EmptyState icon={Package} title={t("empty")} body={t("emptyBody")} />
        ) : (
          <SupplyList
            items={records.map((r) => {
              const calc = calculateLine({ quantity: r.quantity.toString(), unitPrice: r.unitPrice.toString(), taxRate: r.taxRate.toString(), discount: r.discount.toString() });
              return {
                id: r.id,
                branchId: r.branchId,
                branch: `${r.branch.name} (${r.branch.code})`,
                date: formatDay(r.supplyDate, locale),
                item: r.itemName,
                qty: `${formatNumber(r.quantity, locale)} ${r.unit}`,
                total: formatMoney(calc.lineTotal.toFixed(2), "PKR", locale),
                invoice: r.invoice ? { id: r.invoice.id, number: r.invoice.number.startsWith("DRAFT-") ? ti("draftNumber") : r.invoice.number } : null,
              };
            })}
          />
        )}
      </Card>
    </>
  );
}
