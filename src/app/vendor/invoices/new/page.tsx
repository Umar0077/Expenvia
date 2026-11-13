import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { PageHeader } from "@/components/ui/primitives";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";
import { requireActor } from "@/server/auth/session";
import { loadSubject } from "@/server/authz/subject";
import { db } from "@/server/db";
import { dec } from "@/lib/finance/money";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor("VENDOR");
  const subject = await loadSubject(actor);
  const t = await getTranslations("invoices");
  const sp = await searchParams;
  const supplyIds = (sp.supplies ?? "").split(",").filter((s) => z.string().uuid().safeParse(s).success).slice(0, 200);

  // Only active, assigned branches are offered (and the server re-checks on save).
  const branches = await db.branch.findMany({ where: { id: { in: [...(subject.vendorBranchIds ?? [])] }, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } });
  const supplies = supplyIds.length
    ? await db.vendorSupplyRecord.findMany({ where: { id: { in: supplyIds }, vendorId: subject.vendorId ?? "", invoiceId: null }, orderBy: { supplyDate: "asc" } })
    : [];
  const branchId = supplies[0]?.branchId;
  const valid = supplies.length > 0 && supplies.every((s) => s.branchId === branchId);

  return (
    <>
      <PageHeader title={t("builderTitle")} description={t("builderDescription")} />
      <InvoiceBuilder
        branches={branches}
        supplyIds={valid ? supplies.map((s) => s.id) : undefined}
        initial={
          valid
            ? {
                  branchId: branchId!,
                  currency: "PKR",
                  invoiceDate: new Date().toISOString().slice(0, 10),
                  supplyDate: supplies.at(-1)!.supplyDate.toISOString().slice(0, 10),
                  dueDate: "",
                  notes: "",
                  paymentTerms: "",
                  paymentDetails: "",
                  lines: supplies.map((s) => ({
                    itemName: s.itemName,
                    description: s.description ?? "",
                    quantity: dec(s.quantity.toString()).toString(),
                    unit: s.unit,
                    unitPrice: dec(s.unitPrice.toString()).toString(),
                    taxRate: dec(s.taxRate.toString()).toString(),
                    discount: s.discount.toFixed(2),
                  })),
              }
            : undefined
        }
      />
    </>
  );
}
