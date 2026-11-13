import { getLocale, getTranslations } from "next-intl/server";
import { Building2, MapPin } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireActor } from "@/server/auth/session";
import { loadSubject } from "@/server/authz/subject";
import { db } from "@/server/db";
import { formatDate, formatMoney } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

/** Vendors see only basic details of branches assigned to them — no branch financials. */
export default async function VendorBranchesPage() {
  const actor = await requireActor("VENDOR");
  const subject = await loadSubject(actor);
  const t = await getTranslations("vendorBranches");
  const locale = (await getLocale()) as AppLocale;
  const assignments = await db.vendorBranchAssignment.findMany({
    where: { vendorId: subject.vendorId ?? "00000000-0000-0000-0000-000000000000", removedAt: null },
    orderBy: { assignedAt: "asc" },
    include: { branch: { select: { id: true, name: true, code: true, city: true, country: true, address: true, status: true } } },
  });
  // Totals of the vendor's OWN invoices per branch only.
  const own = await db.invoice.groupBy({
    by: ["branchId"],
    where: { vendorId: subject.vendorId ?? "", status: { in: ["APPROVED", "PARTIALLY_PAID", "PAID"] }, currency: "PKR" },
    _sum: { grandTotal: true },
  });

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {assignments.length === 0 ? (
        <Card><EmptyState icon={Building2} title={t("empty")} body={t("emptyBody")} /></Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assignments.map((a) => (
            <li key={a.id}>
              <Card className="h-full p-5">
                <p className="ltr-data text-xs font-semibold text-copper">{a.branch.code}</p>
                <h2 className="mt-1 text-base font-semibold">{a.branch.name}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><MapPin className="size-3.5" /> {[a.branch.address, a.branch.city, a.branch.country].filter(Boolean).join(", ")}</p>
                <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-3 text-sm">
                  <span className="text-muted">{t("since", { date: formatDate(a.assignedAt, locale) })}</span>
                  <span className="text-end">
                    <span className="block text-2xs text-muted">{t("invoiced")}</span>
                    <span className="tabular font-semibold" dir="ltr">{formatMoney(own.find((o) => o.branchId === a.branch.id)?._sum.grandTotal ?? "0", "PKR", locale)}</span>
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
