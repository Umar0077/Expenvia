"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";
import { CurrencyInput, FileUpload } from "@/components/ui/finance-inputs";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { CURRENCIES, expenseSchema, PAYMENT_METHODS, type ExpenseInput } from "@/lib/validation/expense";
import { saveExpenseAction } from "@/server/actions/expenses";

export interface ExpenseFormProps {
  categories: { id: string; name: string }[];
  expense?: { id: string; version: number; status: string; data: ExpenseInput };
  existingAttachments?: number;
}

export function ExpenseForm({ categories, expense, existingAttachments = 0 }: ExpenseFormProps) {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const te = useTranslations("actionErrors");
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState<ExpenseInput | null>(null);

  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: expense?.data ?? {
      categoryId: "",
      title: "",
      description: "",
      amount: "",
      currency: "PKR",
      expenseDate: new Date().toISOString().slice(0, 10),
      payeeName: "",
      paymentMethod: "",
      referenceNumber: "",
    },
  });
  const e = form.formState.errors;
  const currency = form.watch("currency") ?? "PKR";

  const save = (data: ExpenseInput, submit: boolean) =>
    start(async () => {
      setError(undefined);
      const fd = new FormData();
      fd.set("payload", JSON.stringify({ id: expense?.id ?? null, version: expense?.version, submit, data }));
      for (const f of files) fd.append("files", f);
      const res = await saveExpenseAction(fd);
      if (!res.ok) {
        const msg = te.has(res.error as never) ? te(res.error as never) : te("unexpected");
        setError(msg);
        for (const [k, v] of Object.entries(res.fields ?? {})) form.setError(k.replace(/^data\./, "") as keyof ExpenseInput, { message: v });
        setConfirm(null);
        return;
      }
      // Success is only shown after the server confirms the record was persisted.
      toast(submit ? t("submittedToast") : t("saved"));
      setFiles([]);
      setConfirm(null);
      router.push(`/user/expenses/${res.data!.id}`);
      router.refresh();
    });

  return (
    <form noValidate onSubmit={form.handleSubmit((d) => save(d, false))} className="space-y-6">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("titleField")} error={e.title?.message} required className="md:col-span-2">
          <Input placeholder={t("titlePlaceholder")} {...form.register("title")} />
        </Field>
        <Field label={t("category")} error={e.categoryId?.message} required>
          <Select {...form.register("categoryId")}>
            <option value="" disabled>{t("selectCategory")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("date")} error={e.expenseDate?.message} required>
          <Input type="date" max={new Date().toISOString().slice(0, 10)} dir="ltr" className="text-start" {...form.register("expenseDate")} />
        </Field>
        <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
          <Field label={t("currency")}>
            <Select {...form.register("currency")}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label={t("amount")} error={e.amount?.message} required>
            <CurrencyInput currency={currency} placeholder="0.00" {...form.register("amount")} />
          </Field>
        </div>
        <Field label={t("paymentMethod")} error={e.paymentMethod?.message}>
          <Select {...form.register("paymentMethod")}>
            <option value="">{t("notSelected")}</option>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`methods.${m}`)}</option>)}
          </Select>
        </Field>
        <Field label={t("payee")} error={e.payeeName?.message}>
          <Input {...form.register("payeeName")} />
        </Field>
        <Field label={t("reference")} error={e.referenceNumber?.message}>
          <Input dir="ltr" className="text-start" {...form.register("referenceNumber")} />
        </Field>
        <Field label={t("description")} error={e.description?.message} className="md:col-span-2">
          <Textarea {...form.register("description")} />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t("receipts")}</p>
        <FileUpload files={files} onChange={setFiles} existing={existingAttachments} />
      </div>

      {/* Sticky contextual actions on small screens */}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-2 border-t border-border bg-bg/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending && !confirm ? <Loader2 className="animate-spin" /> : <Save />} {t("saveDraft")}
        </Button>
        <Button type="button" disabled={pending} onClick={form.handleSubmit((d) => setConfirm(d))}>
          <Send className="rtl:-scale-x-100" /> {expense?.status === "REVISION_REQUESTED" ? t("resubmit") : t("submit")}
        </Button>
      </div>

      <Modal
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        size="sm"
        title={expense?.status === "REVISION_REQUESTED" ? t("resubmit") : t("submit")}
        description={t("submitConfirm")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>{tc("cancel")}</Button>
            <Button disabled={pending} onClick={() => confirm && save(confirm, true)}>
              {pending && <Loader2 className="animate-spin" />} {tc("confirm")}
            </Button>
          </>
        }
      />
    </form>
  );
}
