import Link from "next/link";
import { AtelierCard } from "@/components/ui/atelier-card";
import { BranchContact } from "@/components/admin/branch-contact";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowUpRight, Building2, MapPin, Store, Users } from "lucide-react";
import { z } from "zod";
import { Badge, Card, EmptyState, PageHeader, STATUS_TONE } from "@/components/ui/primitives";
import { BranchFormButton, BranchStatusButton } from "@/components/admin/branch-controls";
import { FilterBar } from "@/components/ui/filter-bar";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { branchSummaries, currentMonth } from "@/server/services/reporting-service";
import { formatMoney } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export default async function BranchesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireActor("SUPER_ADMIN");
  const sp = await searchParams;
  const q = z.string().trim().max(80).catch("").parse(sp.q ?? "");
  const status = z.enum(["ACTIVE", "INACTIVE"]).optional().catch(undefined).parse(sp.status);
  const t = await getTranslations("branches");
  const ts = await getTranslations("status");
  const locale = (await getLocale()) as AppLocale;

  const ci = { contains: q, mode: "insensitive" as const };
  const [branches, total, summaries] = await Promise.all([
    db.branch.findMany({
      where: { ...(status ? { status } : {}), ...(q ? { OR: [{ name: ci }, { code: ci }, { city: ci }] } : {}) },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: { userAssignments: { where: { endedAt: null } }, vendorAssignments: { where: { removedAt: null } } },
        },
      },
    }),
    db.branch.count(),
    branchSummaries(currentMonth()),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={<BranchFormButton />} />
      {total > 0 && (
        <FilterBar
          search={{ name: "q", placeholder: t("searchPlaceholder"), value: q }}
          selects={[
            {
              name: "status",
              label: t("statusFilter"),
              value: status ?? "",
              options: [
                { value: "ACTIVE", label: ts("ACTIVE") },
                { value: "INACTIVE", label: ts("INACTIVE") },
              ],
            },
          ]}
        />
      )}

      {total === 0 ? (
        <Card>
          <EmptyState icon={Building2} title={t("empty")} body={t("emptyBody")} action={<BranchFormButton />} />
        </Card>
      ) : branches.length === 0 ? (
        <Card>
          <EmptyState icon={Building2} title={t("noMatch")} />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {branches.map((b) => {
            const s = summaries.get(b.id);
            return (
              <li key={b.id}>
                <AtelierCard variant="branch" interactive className="group flex h-full flex-col">
                  <div className="atelier-branch-identity flex flex-wrap items-start justify-between gap-3 p-5">
                    <span className="atelier-monogram" aria-hidden="true">{b.code.slice(0,2)}</span>
                    <div className="min-w-0">
                      <p className="ltr-data text-xs font-semibold tracking-wide text-copper">{b.code}</p>
                      <h2 className="mt-1 text-title font-semibold">{b.name}</h2>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                        <MapPin className="size-3.5" /> {b.city}, {b.country}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[b.status]}>{ts(b.status)}</Badge>
                  </div>
                  <BranchContact branch={b}/>
                  <div className="mx-5 rounded-[var(--radius-md)] bg-surface-2/70 px-4 py-3">
                    <p className="text-xs text-muted">{t("approvedThisMonth")}</p>
                    <p className="tabular mt-0.5 text-lg font-semibold">{formatMoney(s?.approved ?? "0", "PKR", locale)}</p>
                    <p className="mt-0.5 text-xs text-warning">{t("pendingItems", { count: s?.pending ?? 0 })}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-3.5 text-sm text-muted">
                    <span className="flex items-center gap-1.5"><Users className="size-3.5" /> {t("employees", { count: b._count.userAssignments })}</span>
                    <span className="flex items-center gap-1.5"><Store className="size-3.5" /> {t("vendors", { count: b._count.vendorAssignments })}</span>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-border px-3 py-2.5">
                    <Link href={`/admin/branches/${b.id}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-brand hover:bg-brand-soft">
                      {t("viewDetails")} <ArrowUpRight className="size-3.5 rtl:-scale-x-100" />
                    </Link>
                    <div className="flex items-center gap-1">
                      <BranchFormButton branch={b} compact />
                      <BranchStatusButton id={b.id} name={b.name} status={b.status} />
                    </div>
                  </div>
                </AtelierCard>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
