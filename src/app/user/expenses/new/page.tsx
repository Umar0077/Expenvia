import { getLocale, getTranslations } from "next-intl/server";
import { Building2 } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { Alert } from "@/components/ui/form";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { requireActor } from "@/server/auth/session";
import { loadSubject } from "@/server/authz/subject";
import { db } from "@/server/db";

export default async function NewExpensePage() {
  const actor = await requireActor("USER");
  const subject = await loadSubject(actor);
  const t = await getTranslations("expenses");
  const locale = await getLocale();
  const branch = subject.activeBranchId ? await db.branch.findUnique({ where: { id: subject.activeBranchId }, select: { name: true, code: true, status: true } }) : null;
  const categories = await db.expenseCategory.findMany({ where: { isActive: true }, orderBy: { nameEn: "asc" } });

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={t("newTitle")}
        description={t("newDescription")}
        eyebrow={branch && (
          <span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5" /> {branch.name} · <span className="ltr-data">{branch.code}</span></span>
        )}
      />
      {!branch || branch.status !== "ACTIVE" ? (
        <Alert tone="warning">{t("noBranch")}</Alert>
      ) : (
        <Card className="p-4 sm:p-6">
          <ExpenseForm categories={categories.map((c) => ({ id: c.id, name: locale === "ur" ? c.nameUr : c.nameEn }))} />
        </Card>
      )}
    </div>
  );
}
