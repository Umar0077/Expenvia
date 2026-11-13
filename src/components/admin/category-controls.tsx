"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/form";
import { JellyToggle } from "@/components/ui/jelly-toggle";
import { Modal } from "@/components/ui/modal";
import { useServerAction } from "@/components/ui/use-action";
import { useToast } from "@/components/ui/toast";
import { categorySchema, type CategoryInput } from "@/lib/validation/org";
import { saveCategoryAction, setCategoryActiveAction } from "@/server/actions/org";
import { useRouter } from "next/navigation";

export function CategoryFormButton({ category }: { category?: { id: string; key: string; nameEn: string; nameUr: string } }) {
  const t = useTranslations("categories");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: { key: category?.key ?? "", nameEn: category?.nameEn ?? "", nameUr: category?.nameUr ?? "" },
  });
  const save = useServerAction(saveCategoryAction, { success: t("saved"), onSuccess: () => { setOpen(false); if (!category) form.reset(); } });
  const e = form.formState.errors;
  return (
    <>
      {category ? (
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label={t("edit")}><Pencil /></Button>
      ) : (
        <Button onClick={() => setOpen(true)}><Plus /> {t("add")}</Button>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={category ? t("edit") : t("add")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button type="submit" form={`cat-${category?.id ?? "new"}`} disabled={save.pending}>{save.pending && <Loader2 className="animate-spin" />} {tc("save")}</Button>
          </>
        }
      >
        <form id={`cat-${category?.id ?? "new"}`} noValidate className="space-y-4" onSubmit={form.handleSubmit((data) => save.run({ id: category?.id ?? null, data }))}>
          {save.error && <Alert tone="danger">{save.error}</Alert>}
          <Field label={t("nameEn")} error={e.nameEn?.message} required><Input dir="ltr" className="text-start" {...form.register("nameEn")} /></Field>
          <Field label={t("nameUr")} error={e.nameUr?.message} required><Input dir="rtl" lang="ur" className="text-start font-[family-name:var(--font-urdu-ui)]" {...form.register("nameUr")} /></Field>
          <Field label={t("key")} hint={t("keyHint")} error={e.key?.message} required><Input dir="ltr" className="text-start" {...form.register("key")} disabled={!!category} /></Field>
        </form>
      </Modal>
    </>
  );
}

export function CategoryActiveToggle({ id, active, name }: { id: string; active: boolean; name: string }) {
  const t = useTranslations("categories");
  const te = useTranslations("actionErrors");
  const toast = useToast();
  const router = useRouter();
  const [, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(active);
  return (
    <JellyToggle
      size="sm"
      checked={optimistic}
      aria-label={`${t("active")}: ${name}`}
      onCheckedChange={(next) =>
        start(async () => {
          setOptimistic(next);
          const res = await setCategoryActiveAction({ id, isActive: next });
          if (res.ok) {
            toast(t("toggled"));
            router.refresh();
          } else toast(te("unexpected"), "error");
        })
      }
    />
  );
}
