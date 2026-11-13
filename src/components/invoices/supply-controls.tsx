"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { FilePlus2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";
import { CurrencyInput } from "@/components/ui/finance-inputs";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/primitives";
import { useServerAction } from "@/components/ui/use-action";
import { supplySchema, type SupplyInput } from "@/lib/validation/invoice";
import { calculateLine } from "@/lib/finance/money";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AppLocale } from "@/i18n/config";
import { saveSupplyAction } from "@/server/actions/invoices";

export function SupplyForm({ branches }: { branches: { id: string; name: string; code: string }[] }) {
  const t = useTranslations("supplies");
  const tc = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const [open, setOpen] = useState(false);
  const form = useForm<SupplyInput>({
    resolver: zodResolver(supplySchema),
    defaultValues: { branchId: branches.length === 1 ? branches[0]!.id : "", supplyDate: new Date().toISOString().slice(0, 10), itemName: "", description: "", quantity: "1", unit: "pcs", unitPrice: "", taxRate: "0", discount: "0", notes: "" },
  });
  const save = useServerAction(saveSupplyAction, { success: t("saved"), onSuccess: () => { setOpen(false); form.reset(); } });
  const e = form.formState.errors;
  const w = form.watch();
  let preview = "—";
  try {
    preview = formatMoney(calculateLine({ quantity: w.quantity || "0", unitPrice: (w.unitPrice || "0").replace(/,/g, ""), taxRate: w.taxRate || "0", discount: w.discount || "0" }).lineTotal.toFixed(2), "PKR", locale);
  } catch {}

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus /> {t("add")}</Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title={t("add")}
        footer={
          <>
            <span className="me-auto self-center text-sm">{t("lineTotal")}: <b className="tabular" dir="ltr">{preview}</b></span>
            <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button type="submit" form="supply-form" disabled={save.pending}>{save.pending && <Loader2 className="animate-spin" />} {tc("save")}</Button>
          </>
        }
      >
        <form id="supply-form" noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((d) => save.run(d))}>
          {save.error && <Alert tone="danger" className="sm:col-span-2">{save.error}</Alert>}
          <Field label={t("branch")} error={e.branchId?.message} required>
            <Select {...form.register("branchId")}>
              <option value="" disabled>—</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
            </Select>
          </Field>
          <Field label={t("date")} error={e.supplyDate?.message} required><Input type="date" dir="ltr" className="text-start" {...form.register("supplyDate")} /></Field>
          <Field label={t("item")} error={e.itemName?.message} required className="sm:col-span-2"><Input {...form.register("itemName")} /></Field>
          <Field label={t("quantity")} error={e.quantity?.message} required><Input inputMode="decimal" dir="ltr" className="tabular text-end" {...form.register("quantity")} /></Field>
          <Field label={t("unit")} error={e.unit?.message} required><Input {...form.register("unit")} /></Field>
          <Field label={t("unitPrice")} error={e.unitPrice?.message} required><CurrencyInput currency="PKR" {...form.register("unitPrice")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("taxRate")} error={e.taxRate?.message}><Input inputMode="decimal" dir="ltr" className="tabular text-end" {...form.register("taxRate")} /></Field>
            <Field label={t("discount")} error={e.discount?.message}><Input inputMode="decimal" dir="ltr" className="tabular text-end" {...form.register("discount")} /></Field>
          </div>
          <Field label={t("notes")} error={e.notes?.message} className="sm:col-span-2"><Textarea rows={2} {...form.register("notes")} /></Field>
        </form>
      </Modal>
    </>
  );
}

interface SupplyItem {
  id: string;
  branchId: string;
  branch: string;
  date: string;
  item: string;
  qty: string;
  total: string;
  invoice: { id: string; number: string } | null;
}

export function SupplyList({ items }: { items: SupplyItem[] }) {
  const t = useTranslations("supplies");
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const sel = items.filter((i) => selected.includes(i.id));
  const sameBranch = sel.length > 0 && sel.every((i) => i.branchId === sel[0]!.branchId);

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-brand-soft/40 px-4 py-2.5">
          {sameBranch ? <span className="text-sm">{t("billSelected", { count: selected.length })}</span> : <span className="text-sm text-warning">{t("sameBranch")}</span>}
          <Button size="sm" disabled={!sameBranch} onClick={() => router.push(`/vendor/invoices/new?supplies=${selected.join(",")}`)}><FilePlus2 /> {t("billSelected", { count: selected.length })}</Button>
        </div>
      )}
      <ul className="divide-y divide-border">
        {items.map((i) => (
          <li key={i.id} className={cn("flex items-center gap-3 px-4 py-3", i.invoice && "opacity-75")}>
            <input
              type="checkbox"
              disabled={!!i.invoice}
              checked={selected.includes(i.id)}
              onChange={() => setSelected((s) => (s.includes(i.id) ? s.filter((x) => x !== i.id) : [...s, i.id]))}
              className="size-4 shrink-0 accent-[var(--brand)] disabled:opacity-30"
              aria-label={i.item}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" dir="auto">{i.item}</p>
              <p className="truncate text-xs text-muted">{i.branch} · {i.date} · <span dir="ltr">{i.qty}</span></p>
            </div>
            <div className="shrink-0 text-end">
              <p className="tabular text-sm font-semibold" dir="ltr">{i.total}</p>
              {i.invoice ? (
                <Link href={`/vendor/invoices/${i.invoice.id}`} className="text-xs text-brand hover:underline"><span className="ltr-data">{i.invoice.number}</span></Link>
              ) : (
                <Badge tone="warning" className="mt-0.5">{t("unbilled")}</Badge>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
