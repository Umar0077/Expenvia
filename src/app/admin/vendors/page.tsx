import { getLocale, getTranslations } from "next-intl/server";
import { AtelierCard } from "@/components/ui/atelier-card";
import { Store } from "lucide-react";
import { z } from "zod";
import { Badge, Card, EmptyState, PageHeader, STATUS_TONE, Table, Td, Th, Tr } from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/filter-bar";
import { Pagination, PAGE_SIZE, pageFrom } from "@/components/ui/pagination";
import { VendorManager } from "@/components/admin/vendor-manager";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { formatDate, formatMoney } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export default async function VendorsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireActor("SUPER_ADMIN");
  const sp = await searchParams;
  const q = z.string().trim().max(80).catch("").parse(sp.q ?? "");
  const branch = z.string().uuid().optional().catch(undefined).parse(sp.branch);
  const page = pageFrom(sp);
  const t = await getTranslations("vendors");
  const ts = await getTranslations("status");
  const tn = await getTranslations("nav");
  const locale = (await getLocale()) as AppLocale;

  const ci = { contains: q, mode: "insensitive" as const };
  const where = {
    ...(q ? { OR: [{ businessName: ci }, { contactPerson: ci }, { businessEmail: ci }] } : {}),
    ...(branch ? { branchAssignments: { some: { branchId: branch, removedAt: null } } } : {}),
  };
  const [rows, total, branches] = await Promise.all([
    db.vendorProfile.findMany({
      where,
      orderBy: { businessName: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { id: true, status: true, email: true } },
        branchAssignments: { orderBy: { assignedAt: "desc" }, include: { branch: { select: { id: true, name: true, code: true } }, assignedBy: { select: { fullName: true } } } },
        _count: { select: { invoices: { where: { status: { not: "DRAFT" } } } } },
      },
    }),
    db.vendorProfile.count({ where }),
    db.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true, status: true } }),
  ]);
  const outstanding = await db.$queryRaw<{ vendor_id: string; amount: string }[]>`
    SELECT vendor_id, SUM(grand_total - amount_paid)::text AS amount FROM invoices
    WHERE status IN ('APPROVED','PARTIALLY_PAID') AND vendor_id = ANY(${rows.map((r) => r.id)}::uuid[])
    GROUP BY vendor_id`;
  const outMap = new Map(outstanding.map((o) => [o.vendor_id, o.amount]));

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <FilterBar
        search={{ name: "q", placeholder: t("searchPlaceholder"), value: q }}
        selects={[{ name: "branch", label: tn("branches"), value: branch ?? "", options: branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })) }]}
      />
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Store} title={t("empty")} body={t("emptyBody")} />
        ) : (
          <>
            <div className="grid gap-4 p-4 lg:grid-cols-2">
                {rows.map((v) => {
                  const active = v.branchAssignments.filter((a) => !a.removedAt);
                  return (
                    <AtelierCard key={v.id} variant="vendor" interactive>
                        <div className="flex flex-wrap items-start gap-3">
                          <span className="atelier-monogram" aria-hidden="true">{v.businessName.slice(0,2).toUpperCase()}</span>
                          <div className="min-w-0 flex-1"><h2 className="text-title font-semibold break-words">{v.businessName}</h2><p className="mt-1 text-sm text-muted">{v.contactPerson}</p></div>
                          <Badge tone={STATUS_TONE[v.user.status]}>{ts(v.user.status as "ACTIVE")}</Badge>
                        </div>
                        <p className="ltr-data mt-3 break-all text-sm text-muted">{v.businessEmail}</p>
                        <div className="atelier-vendor-stats">
                         <div><p className="text-xs text-muted">{t("invoices")}</p><p className="tabular mt-1 text-section font-semibold">{v._count.invoices}</p></div>
                         <div><p className="text-xs text-muted">{t("outstanding")}</p><p className="tabular mt-1 break-words text-section font-semibold text-copper" dir="ltr">{formatMoney(outMap.get(v.id) ?? "0", "PKR", locale)}</p></div>
                        </div>
                        <p className="mb-2 text-xs font-medium text-muted">{t("coverage")} · {active.length}</p>
                        {active.length === 0 ? (
                          <Badge tone="warning">0</Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {active.map((a) => (
                              <Badge key={a.id} tone="brand" dot={false} className="ltr-data">{a.branch.code}</Badge>
                            ))}
                          </div>
                        )}
                      <div className="mt-4 flex justify-end">
                        <VendorManager
                          vendor={{ id: v.id, userId: v.user.id, businessName: v.businessName, email: v.businessEmail, phone: v.businessPhone, taxId: v.taxIdentifier, address: v.businessAddress, status: v.user.status }}
                          active={active.map((a) => ({ branchId: a.branch.id, label: `${a.branch.name} (${a.branch.code})` }))}
                          branches={branches.filter((b) => b.status === "ACTIVE" && !active.some((a) => a.branch.id === b.id))}
                          history={v.branchAssignments.map((a) => ({
                            id: a.id,
                            branch: `${a.branch.name} (${a.branch.code})`,
                            from: formatDate(a.assignedAt, locale),
                            to: a.removedAt ? formatDate(a.removedAt, locale) : null,
                            by: a.assignedBy.fullName,
                          }))}
                        />
                      </div>
                    </AtelierCard>
                  );
                })}
            </div>
            <Pagination page={page} total={total} sp={sp} />
          </>
        )}
      </Card>
    </>
  );
}
