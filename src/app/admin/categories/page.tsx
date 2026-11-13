import { getTranslations } from "next-intl/server";
import { FolderTree } from "lucide-react";
import { Card, EmptyState, PageHeader, Table, Td, Th, Tr } from "@/components/ui/primitives";
import { CategoryActiveToggle, CategoryFormButton } from "@/components/admin/category-controls";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";

export default async function CategoriesPage() {
  await requireActor("SUPER_ADMIN");
  const t = await getTranslations("categories");
  const rows = await db.expenseCategory.findMany({ orderBy: [{ isActive: "desc" }, { nameEn: "asc" }], include: { _count: { select: { expenses: true } } } });
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={<CategoryFormButton />} />
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={FolderTree} title={t("empty")} action={<CategoryFormButton />} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("nameEn")}</Th>
                <Th>{t("nameUr")}</Th>
                <Th className="hidden md:table-cell">{t("key")}</Th>
                <Th num>{t("usage")}</Th>
                <Th>{t("active")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <Tr key={c.id} className={c.isActive ? "" : "opacity-60"}>
                  <Td className="font-medium">{c.nameEn}</Td>
                  <Td><span lang="ur" dir="rtl" className="font-[family-name:var(--font-urdu-ui)]">{c.nameUr}</span></Td>
                  <Td className="ltr-data hidden text-muted md:table-cell">{c.key}</Td>
                  <Td num>{c._count.expenses}</Td>
                  <Td><CategoryActiveToggle id={c.id} active={c.isActive} name={c.nameEn} /></Td>
                  <Td className="text-end"><CategoryFormButton category={c} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
