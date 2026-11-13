"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Eye, GripVertical, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { CURRENCIES } from "@/lib/validation/expense";
import { invoiceSchema, MAX_LINES, type InvoiceInput } from "@/lib/validation/invoice";
import { calculateLine, dec, sum } from "@/lib/finance/money";
import { formatMoney } from "@/lib/format";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/cn";
import type { AppLocale } from "@/i18n/config";
import { saveInvoiceAction } from "@/server/actions/invoices";

type Line = InvoiceInput["lines"][number] & { key: string };
const blankLine = (): Line => ({ key: crypto.randomUUID(), itemName: "", description: "", quantity: "1", unit: "pcs", unitPrice: "", taxRate: "0", discount: "0" });

/** Safe live calculation for display; invalid rows contribute nothing until fixed. */
function liveLine(l: Partial<Line>, currency: string) {
  try {
    return calculateLine({ quantity: (l.quantity || "0").replace(/,/g, ""), unitPrice: (l.unitPrice || "0").replace(/,/g, ""), taxRate: l.taxRate || "0", discount: (l.discount || "0").replace(/,/g, "") }, currency);
  } catch {
    return null;
  }
}

export interface InvoiceBuilderProps {
  branches: { id: string; name: string; code: string }[];
  invoice?: { id: string; version: number; status: string; number: string; data: InvoiceInput };
  /** Prefill for a NEW invoice (e.g. from supply records). */
  initial?: InvoiceInput;
  supplyIds?: string[];
}

export function InvoiceBuilder({ branches, invoice, initial, supplyIds }: InvoiceBuilderProps) {
  const seed = invoice?.data ?? initial;
  const t = useTranslations("invoices");
  const tc = useTranslations("common");
  const te = useTranslations("actionErrors");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const form = useForm<{ header: Omit<InvoiceInput, "lines">; lines: Line[] }>({
    defaultValues: {
      header: seed
        ? ({ ...seed, lines: undefined } as never)
        : { branchId: branches.length === 1 ? branches[0]!.id : "", currency: "PKR", invoiceDate: new Date().toISOString().slice(0, 10), supplyDate: "", dueDate: "", notes: "", paymentTerms: "", paymentDetails: "" },
      lines: seed ? seed.lines.map((l) => ({ ...l, key: crypto.randomUUID() })) : [blankLine()],
    },
  });
  const { fields, append, remove, move, replace } = useFieldArray({ control: form.control, name: "lines", keyName: "_id" });
  const currency = useWatch({ control: form.control, name: "header.currency" }) ?? "PKR";
  const errs = form.formState.errors;
  const totals = useTotals(form.control, currency);

  const collect = (): InvoiceInput | null => {
    const v = form.getValues();
    const data: InvoiceInput = { ...v.header, lines: v.lines.map(({ key: _k, ...l }) => l) };
    const parsed = invoiceSchema.safeParse(data);
    form.clearErrors();
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const [first, ...rest] = issue.path;
        const path = first === "lines" ? `lines.${rest.join(".")}` : `header.${[first, ...rest].join(".")}`;
        form.setError(path as never, { message: issue.message });
      }
      setError(te("validationFailed"));
      return null;
    }
    setError(undefined);
    return data;
  };

  const persist = (submit: boolean, then?: (id: string) => void) => {
    const data = collect();
    if (!data) return;
    start(async () => {
      const res = await saveInvoiceAction({ id: invoice?.id ?? null, version: invoice?.version, submit, supplyIds: invoice ? undefined : supplyIds, data });
      if (!res.ok) {
        setError(te.has(res.error as never) ? te(res.error as never) : te("unexpected"));
        setConfirm(false);
        return;
      }
      toast(submit ? t("submitted") : t("saved"));
      setConfirm(false);
      if (then) then(res.data!.id);
      else {
        router.push(`/vendor/invoices/${res.data!.id}`);
        router.refresh();
      }
    });
  };

  if (branches.length === 0) return <Alert tone="warning">{t("noBranches")}</Alert>;

  return (
    <div className="space-y-6">
      {error && <Alert tone="danger">{error}</Alert>}

      {/* Header */}
      <section className="surface-card grid gap-5 p-5 sm:p-6 md:grid-cols-3">
        <Field label={t("branch")} error={errs.header?.branchId?.message} required className="md:col-span-2">
          <Select {...form.register("header.branchId")}>
            <option value="" disabled>{t("selectBranch")}</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
          </Select>
        </Field>
        <Field label={t("currency")}>
          <Select {...form.register("header.currency")}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
        </Field>
        <Field label={t("invoiceDate")} error={errs.header?.invoiceDate?.message} required>
          <Input type="date" dir="ltr" className="text-start" {...form.register("header.invoiceDate")} />
        </Field>
        <Field label={t("supplyDate")} error={errs.header?.supplyDate?.message}>
          <Input type="date" dir="ltr" className="text-start" {...form.register("header.supplyDate")} />
        </Field>
        <Field label={t("dueDate")} error={errs.header?.dueDate?.message}>
          <Input type="date" dir="ltr" className="text-start" {...form.register("header.dueDate")} />
        </Field>
      </section>

      {/* Lines */}
      <section className="surface-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-body font-semibold">{t("lineItems")} <span className="tabular text-muted">({fields.length})</span></h2>
          <Button size="sm" variant="subtle" disabled={fields.length >= MAX_LINES} onClick={() => append(blankLine())}><Plus /> {t("addLine")}</Button>
        </div>
        <div className="hidden grid-cols-[28px_minmax(0,2.4fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_72px] gap-2 border-b border-border bg-surface-2/50 px-4 py-2 text-2xs font-semibold uppercase tracking-[0.04em] text-muted lg:grid">
          <span />
          <span>{t("itemName")}</span>
          <span className="text-end">{t("quantity")}</span>
          <span>{t("unit")}</span>
          <span className="text-end">{t("unitPrice")}</span>
          <span className="text-end">{t("taxRate")}</span>
          <span className="text-end">{t("discount")}</span>
          <span className="text-end">{t("lineTotal")}</span>
          <span />
        </div>
        <Reorder.Group
          as="ol"
          axis="y"
          values={fields.map((f) => f.key)}
          onReorder={(keys: string[]) => {
            const current = form.getValues("lines");
            replace(keys.map((k) => current.find((l) => l.key === k)!).filter(Boolean));
          }}
          className="divide-y divide-border"
        >
          <AnimatePresence initial={false}>
            {fields.map((f, i) => (
              <LineRow
                key={f.key}
                id={f.key}
                index={i}
                count={fields.length}
                control={form.control}
                register={form.register}
                errors={errs.lines?.[i]}
                currency={currency}
                locale={locale}
                onRemove={() => remove(i)}
                onMove={(d) => move(i, i + d)}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
        {errs.lines?.message && <p className="px-5 py-3 text-sm text-danger">{errs.lines.message}</p>}
        <Totals control={form.control} currency={currency} locale={locale} />
      </section>

      {/* Footer */}
      <section className="surface-card grid gap-5 p-5 sm:p-6 md:grid-cols-2">
        <Field label={t("notes")} error={errs.header?.notes?.message}><Textarea {...form.register("header.notes")} /></Field>
        <div className="space-y-5">
          <Field label={t("paymentTerms")} error={errs.header?.paymentTerms?.message}><Input placeholder={t("paymentTermsPlaceholder")} {...form.register("header.paymentTerms")} /></Field>
          <Field label={t("paymentDetails")} hint={t("paymentDetailsHint")} error={errs.header?.paymentDetails?.message}><Textarea rows={2} {...form.register("header.paymentDetails")} /></Field>
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap justify-end gap-2 border-t border-border bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button variant="ghost" disabled={pending} onClick={() => persist(false, (id) => setPreview(id))}><Eye /> {t("preview")}</Button>
        <Button variant="secondary" disabled={pending} onClick={() => persist(false)}>{pending && !confirm ? <Loader2 className="animate-spin" /> : <Save />} {t("saveDraft")}</Button>
        <Button disabled={pending} onClick={() => collect() && setConfirm(true)}><Send className="rtl:-scale-x-100" /> {invoice?.status === "REVISION_REQUESTED" ? t("resubmit") : t("submit")}</Button>
      </div>

      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        size="sm"
        title={t("submitConfirmTitle", { amount: formatMoney(totals.grand.toFixed(2), currency, locale) })}
        description={t("submitConfirmBody")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>{tc("cancel")}</Button>
            <Button disabled={pending} onClick={() => persist(true)}>{pending && <Loader2 className="animate-spin" />} {tc("confirm")}</Button>
          </>
        }
      />
      <Modal open={!!preview} onOpenChange={(o) => { if (!o) { setPreview(null); if (!invoice) router.push(`/vendor/invoices/${preview}`); } }} size="lg" title={t("previewTitle")}>
        {preview && <iframe title={t("previewTitle")} src={`/api/invoices/${preview}/document?format=html&lang=${locale}`} className="h-[70vh] w-full rounded-[var(--radius-md)] border border-border bg-white" />}
      </Modal>
    </div>
  );
}

function LineRow({
  id,
  index,
  count,
  control,
  register,
  errors,
  currency,
  locale,
  onRemove,
  onMove,
}: {
  id: string;
  index: number;
  count: number;
  control: Control<{ header: Omit<InvoiceInput, "lines">; lines: Line[] }>;
  register: ReturnType<typeof useForm<{ header: Omit<InvoiceInput, "lines">; lines: Line[] }>>["register"];
  errors?: Partial<Record<keyof Line, { message?: string }>>;
  currency: string;
  locale: AppLocale;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  const t = useTranslations("invoices");
  const tv = useTranslations("validation");
  const drag = useDragControls();
  const fieldId = useId();
  const line = useWatch({ control, name: `lines.${index}` });
  const calc = liveLine(line ?? {}, currency);
  const n = index + 1;
  const err = (k: keyof Line) => errors?.[k]?.message;
  const cell = "h-10 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 aria-[invalid=true]:border-danger";
  const num = cn(cell, "tabular text-end");

  return (
    <Reorder.Item
      as="li"
      value={id}
      dragListener={false}
      dragControls={drag}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: duration.standard, ease: ease.out }}
      className="relative bg-surface"
    >
      <div className="grid grid-cols-2 gap-2 px-4 py-3 lg:grid-cols-[28px_minmax(0,2.4fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_72px] lg:items-start">
        <button
          type="button"
          onPointerDown={(e) => drag.start(e)}
          aria-label={t("dragHandle", { n })}
          className="col-span-2 hidden h-10 cursor-grab touch-none place-items-center rounded text-muted hover:text-text active:cursor-grabbing lg:col-span-1 lg:grid"
        >
          <GripVertical className="size-4" />
        </button>
        <div className="col-span-2 space-y-1.5 lg:col-span-1">
          <label className="sr-only" htmlFor={`${fieldId}-name`}>{t("itemName")} {n}</label>
          <input id={`${fieldId}-name`} placeholder={t("itemPlaceholder")} aria-invalid={!!err("itemName") || undefined} className={cell} {...register(`lines.${index}.itemName`)} />
          <label className="sr-only" htmlFor={`${fieldId}-desc`}>{t("lineDescription")} {n}</label>
          <input id={`${fieldId}-desc`} placeholder={t("lineDescription")} className={cn(cell, "h-8 text-sm text-muted")} {...register(`lines.${index}.description`)} />
        </div>
        <LabeledCell label={t("quantity")}><input inputMode="decimal" dir="ltr" aria-label={`${t("quantity")} ${n}`} aria-invalid={!!err("quantity") || undefined} className={num} {...register(`lines.${index}.quantity`)} /></LabeledCell>
        <LabeledCell label={t("unit")}><input aria-label={`${t("unit")} ${n}`} aria-invalid={!!err("unit") || undefined} className={cell} {...register(`lines.${index}.unit`)} /></LabeledCell>
        <LabeledCell label={t("unitPrice")}><input inputMode="decimal" dir="ltr" placeholder="0.00" aria-label={`${t("unitPrice")} ${n}`} aria-invalid={!!err("unitPrice") || undefined} className={num} {...register(`lines.${index}.unitPrice`)} /></LabeledCell>
        <LabeledCell label={t("taxRate")}><input inputMode="decimal" dir="ltr" aria-label={`${t("taxRate")} ${n}`} aria-invalid={!!err("taxRate") || undefined} className={num} {...register(`lines.${index}.taxRate`)} /></LabeledCell>
        <LabeledCell label={t("discount")}><input inputMode="decimal" dir="ltr" aria-label={`${t("discount")} ${n}`} aria-invalid={!!err("discount") || undefined} className={num} {...register(`lines.${index}.discount`)} /></LabeledCell>
        <LabeledCell label={t("lineTotal")}>
          <p className="tabular flex h-10 items-center justify-end text-sm font-semibold" dir="ltr" aria-live="polite">
            {calc ? formatMoney(calc.lineTotal.toFixed(2), currency, locale) : <span className="text-danger">—</span>}
          </p>
        </LabeledCell>
        <div className="col-span-2 flex items-center justify-end gap-0.5 lg:col-span-1 lg:h-10">
          <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label={t("moveUp", { n })}><ArrowUp /></Button>
          <Button variant="ghost" size="icon-sm" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={t("moveDown", { n })}><ArrowDown /></Button>
          <Button variant="ghost" size="icon-sm" className="text-muted hover:text-danger" disabled={count === 1} onClick={onRemove} aria-label={t("removeLine", { n })}><Trash2 /></Button>
        </div>
      </div>
      {errors && Object.values(errors).some((e) => e?.message) && (
        <p role="alert" className="px-4 pb-2 text-xs text-danger lg:ps-12">
          {[...new Set(Object.values(errors).map((e) => e?.message).filter(Boolean))].map((m) => (tv.has(m as never) ? tv(m as never) : m)).join(" · ")}
        </p>
      )}
    </Reorder.Item>
  );
}

function LabeledCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-2xs font-medium text-muted lg:hidden">{label}</span>
      {children}
    </div>
  );
}

function useTotals(control: Control<{ header: Omit<InvoiceInput, "lines">; lines: Line[] }>, currency: string) {
  const lines = useWatch({ control, name: "lines" });
  return useMemo(() => {
    const calcs = (lines ?? []).map((l) => liveLine(l, currency)).filter((c): c is NonNullable<typeof c> => !!c);
    const subtotal = sum(calcs.map((c) => c.lineSubtotal));
    const discount = sum(calcs.map((c) => c.discount));
    const tax = sum(calcs.map((c) => c.lineTax));
    return { subtotal, discount, tax, grand: subtotal.minus(discount).plus(tax), invalid: calcs.length !== (lines ?? []).length };
  }, [lines, currency]);
}

function Totals({ control, currency, locale }: { control: Control<{ header: Omit<InvoiceInput, "lines">; lines: Line[] }>; currency: string; locale: AppLocale }) {
  const t = useTranslations("invoices");
  const { subtotal, discount, tax, grand } = useTotals(control, currency);
  const m = (v: ReturnType<typeof dec>) => formatMoney(v.toFixed(2), currency, locale);
  return (
    <div className="flex justify-end border-t border-border bg-surface-2/40 px-5 py-4">
      <dl className="w-full max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between"><dt className="text-muted">{t("subtotal")}</dt><dd className="tabular" dir="ltr">{m(subtotal)}</dd></div>
        {!discount.isZero() && <div className="flex justify-between"><dt className="text-muted">{t("discountTotal")}</dt><dd className="tabular text-copper" dir="ltr">− {m(discount)}</dd></div>}
        {!tax.isZero() && <div className="flex justify-between"><dt className="text-muted">{t("taxTotal")}</dt><dd className="tabular" dir="ltr">{m(tax)}</dd></div>}
        <div className="flex justify-between border-t border-border-strong pt-2 text-base font-semibold">
          <dt>{t("grandTotal")}</dt>
          <motion.dd key={grand.toFixed(2)} initial={{ opacity: 0.4, y: -3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.micro }} className="tabular text-brand" dir="ltr">
            {m(grand)}
          </motion.dd>
        </div>
      </dl>
    </div>
  );
}
