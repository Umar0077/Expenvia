import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus, Receipt } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/filter-bar";
import { Pagination, PAGE_SIZE, pageFrom } from "@/components/ui/pagination";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";

const STATUSES = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REVISION_REQUESTED"] as const;

export default async function MyExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor("USER");
  const sp = await searchParams;
  const q = z.string().trim().max(80).catch("").parse(sp.q ?? "");
  const status = z.enum(STATUSES).optional().catch(undefined).parse(sp.status);
  const page = pageFrom(sp);
  const t = await getTranslations("expenses");
  const ts = await getTranslations("status");

  const ci = { contains: q, mode: "insensitive" as const };
  // Ownership filter is applied server-side on every query — never from the client.
  const where = { ownerId: actor.userId, ...(status ? { status } : {}), ...(q ? { OR: [{ title: ci }, { number: ci }, { referenceNumber: ci }] } : {}) };
  const [rows, total, any] = await Promise.all([
    db.expense.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { category: { select: { nameEn: true, nameUr: true } }, _count: { select: { attachments: true } } },
    }),
    db.expense.count({ where }),
    db.expense.count({ where: { ownerId: actor.userId } }),
  ]);

  const newBtn = (
    <Button asChild>
      <Link href="/user/expenses/new"><Plus /> {t("new")}</Link>
    </Button>
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={newBtn} />
      {any > 0 && (
        <FilterBar
          search={{ name: "q", placeholder: t("searchPlaceholder"), value: q }}
          selects={[{ name: "status", label: t("status"), value: status ?? "", options: STATUSES.map((s) => ({ value: s, label: ts(s) })) }]}
        />
      )}
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Receipt} title={t("empty")} body={t("emptyBody")} action={any === 0 ? newBtn : undefined} />
        ) : (
          <>
            <ExpenseTable rows={rows} href={(id) => `/user/expenses/${id}`} />
            <Pagination page={page} total={total} sp={sp} />
          </>
        )}
      </Card>
    </>
  );
}
