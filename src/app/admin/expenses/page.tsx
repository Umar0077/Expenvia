import { getTranslations } from "next-intl/server";
import { Receipt } from "lucide-react";
import { z } from "zod";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/filter-bar";
import { Pagination, PAGE_SIZE, pageFrom } from "@/components/ui/pagination";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { ExpenseReviewPanel } from "@/components/expenses/expense-review-panel";
import { ExportButton } from "@/components/admin/export-button";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { getLocale } from "next-intl/server";

const STATUSES = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REVISION_REQUESTED"] as const;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);

export default async function AdminExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireActor("SUPER_ADMIN");
  const sp = await searchParams;
  const q = z.string().trim().max(80).catch("").parse(sp.q ?? "");
  const status = z.enum(STATUSES).optional().catch(undefined).parse(sp.status);
  const branch = z.string().uuid().optional().catch(undefined).parse(sp.branch);
  const category = z.string().uuid().optional().catch(undefined).parse(sp.category);
  const owner = z.string().uuid().optional().catch(undefined).parse(sp.owner);
  const from = date.parse(sp.from);
  const to = date.parse(sp.to);
  const selectedId = z.string().uuid().safeParse(sp.id).data;
  const page = pageFrom(sp);
  const t = await getTranslations("expenses");
  const ts = await getTranslations("status");
  const tn = await getTranslations("nav");
  const locale = await getLocale();

  const ci = { contains: q, mode: "insensitive" as const };
  // Admins never see other people's drafts — drafts are private until submitted.
  const where = {
    status: status ? status : { not: "DRAFT" as const },
    ...(branch ? { branchId: branch } : {}),
    ...(category ? { categoryId: category } : {}),
    ...(owner ? { ownerId: owner } : {}),
    ...(from || to ? { expenseDate: { ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}), ...(to ? { lte: new Date(`${to}T00:00:00Z`) } : {}) } } : {}),
    ...(q ? { OR: [{ title: ci }, { number: ci }, { referenceNumber: ci }, { payeeName: ci }] } : {}),
  };
  const [rows, total, branches, categories, owners] = await Promise.all([
    db.expense.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { category: { select: { nameEn: true, nameUr: true } }, branch: { select: { name: true, code: true } }, owner: { select: { fullName: true } }, _count: { select: { attachments: true } } },
    }),
    db.expense.count({ where }),
    db.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.expenseCategory.findMany({ orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true, nameUr: true } }),
    db.user.findMany({ where: { role: "USER" }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "id" && k !== "page") as [string, string][]);

  return (
    <>
      <PageHeader title={t("adminTitle")} description={t("adminDescription")} actions={<ExportButton report="expenses" query={qs.toString()} />} />
      <FilterBar
        search={{ name: "q", placeholder: t("searchPlaceholder"), value: q }}
        selects={[
          { name: "status", label: t("status"), value: status ?? "", options: STATUSES.map((s) => ({ value: s, label: ts(s) })) },
          { name: "branch", label: tn("branches"), value: branch ?? "", options: branches.map((b) => ({ value: b.id, label: b.name })) },
          { name: "category", label: t("category"), value: category ?? "", options: categories.map((c) => ({ value: c.id, label: locale === "ur" ? c.nameUr : c.nameEn })) },
          { name: "owner", label: t("owner"), value: owner ?? "", options: owners.map((o) => ({ value: o.id, label: o.fullName })) },
        ]}
        dates={[
          { name: "from", label: "↦", value: from ?? "" },
          { name: "to", label: "↤", value: to ?? "" },
        ]}
      />
      <div className={selectedId ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]" : ""}>
        <Card className="h-fit overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState icon={Receipt} title={t("empty")} />
          ) : (
            <>
              <ExpenseTable rows={rows} showOwner href={(id) => `?${new URLSearchParams([...qs, ["id", id]]).toString()}`} />
              <Pagination page={page} total={total} sp={sp} />
            </>
          )}
        </Card>
        {selectedId && (
          <div className="xl:sticky xl:top-[calc(var(--header-h)+24px)] xl:h-fit">
            <ExpenseReviewPanel id={selectedId} />
          </div>
        )}
      </div>
    </>
  );
}
