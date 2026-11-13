"use client";

import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Banknote, Check, Link2, Loader2, RotateCcw, Undo2, Unlink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/form";
import { CurrencyInput } from "@/components/ui/finance-inputs";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/primitives";
import { useServerAction } from "@/components/ui/use-action";
import { PAYMENT_METHODS } from "@/lib/validation/expense";
import { formatMoney } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";
import { correctPaymentAction, linkReconciliationAction, recordPaymentAction, reviewInvoiceAction, unlinkReconciliationAction } from "@/server/actions/invoices";

type Decision = "APPROVED" | "REJECTED" | "REVISION_REQUESTED";

export function InvoiceReviewButtons({ id, number, amount }: { id: string; number: string; amount: string }) {
  const t = useTranslations("invoices");
  const tc = useTranslations("common");
  const [open, setOpen] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const msg = open === "APPROVED" ? t("approvedToast") : open === "REJECTED" ? t("rejectedToast") : t("revisionToast");
  const act = useServerAction(reviewInvoiceAction, { success: msg, onSuccess: () => { setOpen(null); setNote(""); } });
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button className="flex-1" onClick={() => setOpen("APPROVED")}><Check /> {t("approve")}</Button>
        <Button variant="secondary" onClick={() => setOpen("REVISION_REQUESTED")}><RotateCcw /> {t("requestRevision")}</Button>
        <Button variant="secondary" className="text-danger" onClick={() => setOpen("REJECTED")}><X /> {t("reject")}</Button>
      </div>
      <Modal
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        size="sm"
        title={open === "APPROVED" ? t("approveTitle", { number }) : open === "REJECTED" ? t("rejectTitle", { number }) : t("revisionTitle", { number })}
        description={open === "APPROVED" ? t("approveBody", { amount }) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)}>{tc("cancel")}</Button>
            <Button variant={open === "REJECTED" ? "danger" : "primary"} disabled={act.pending || (open !== "APPROVED" && note.trim().length < 3)} onClick={() => open && act.run({ id, decision: open, note })}>
              {act.pending && <Loader2 className="animate-spin" />} {open === "APPROVED" ? t("approve") : open === "REJECTED" ? t("reject") : t("requestRevision")}
            </Button>
          </>
        }
      >
        {act.error && <Alert tone="danger" className="mb-3">{act.error}</Alert>}
        {open !== "APPROVED" && <Field label={t("reasonLabel")} required><Textarea value={note} onChange={(e) => setNote(e.target.value)} autoFocus /></Field>}
      </Modal>
    </>
  );
}

export function RecordPaymentButton({ invoiceId, currency, outstanding }: { invoiceId: string; currency: string; outstanding: string }) {
  const t = useTranslations("invoices");
  const te = useTranslations("expenses");
  const tc = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const proof = useRef<HTMLInputElement>(null);
  // One idempotency key per dialog session: double-clicks/retries can't create two payments.
  const key = useMemo(() => crypto.randomUUID(), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = useServerAction(async (fd: FormData) => recordPaymentAction(fd), { success: t("paymentRecorded"), onSuccess: () => { setOpen(false); setAmount(""); setReference(""); setNotes(""); } });

  const submit = () => {
    const fd = new FormData();
    fd.set("payload", JSON.stringify({ invoiceId, amount, paymentDate: date, method, reference, notes, idempotencyKey: key }));
    const f = proof.current?.files?.[0];
    if (f) fd.set("proof", f);
    act.run(fd);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Banknote /> {t("recordPayment")}</Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t("recordPayment")}
        description={t("maxPayable", { amount: formatMoney(outstanding, currency, locale) })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button disabled={act.pending || !amount} onClick={submit}>{act.pending && <Loader2 className="animate-spin" />} {t("recordPayment")}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {act.error && <Alert tone="danger" className="sm:col-span-2">{act.error}</Alert>}
          <Field label={t("paymentAmount")} error={act.fields.amount} required className="sm:col-span-2">
            <div className="flex gap-2">
              <div className="flex-1"><CurrencyInput currency={currency} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
              <Button variant="secondary" className="h-11" onClick={() => setAmount(outstanding)}>{t("payFull")}</Button>
            </div>
          </Field>
          <Field label={t("paymentDate")} error={act.fields.paymentDate} required><Input type="date" dir="ltr" className="text-start" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={t("paymentMethod")}>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{te(`methods.${m}`)}</option>)}</Select>
          </Field>
          <Field label={t("paymentReference")} error={act.fields.reference} className="sm:col-span-2"><Input dir="ltr" className="text-start" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          <Field label={t("paymentNotes")} className="sm:col-span-2"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Field label={t("paymentProof")} className="sm:col-span-2"><input ref={proof} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="block w-full text-sm file:me-3 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:text-brand" /></Field>
        </div>
      </Modal>
    </>
  );
}

export function ReversePaymentButton({ paymentId, amount }: { paymentId: string; amount: string }) {
  const t = useTranslations("invoices");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const key = useMemo(() => crypto.randomUUID(), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = useServerAction(correctPaymentAction, { success: t("corrected"), onSuccess: () => setOpen(false) });
  return (
    <>
      <Button variant="ghost" size="sm" className="text-muted hover:text-danger" onClick={() => setOpen(true)}><Undo2 /> {t("correct")}</Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title={t("correctTitle")}
        description={t("correctBody", { amount: `−${amount}` })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button variant="danger" disabled={act.pending || reason.trim().length < 3} onClick={() => act.run({ paymentId, reason, idempotencyKey: key })}>{act.pending && <Loader2 className="animate-spin" />} {t("correct")}</Button>
          </>
        }
      >
        {act.error && <Alert tone="danger" className="mb-3">{act.error}</Alert>}
        <Field label={t("correctReason")} required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </>
  );
}

export function ReconcilePanel({ invoiceId, candidates, links }: { invoiceId: string; candidates: { id: string; label: string }[]; links: { id: string; label: string; type: "DUPLICATE_OF" | "RELATED" }[] }) {
  const t = useTranslations("invoices");
  const [expenseId, setExpenseId] = useState("");
  const [type, setType] = useState<"DUPLICATE_OF" | "RELATED">("DUPLICATE_OF");
  const link = useServerAction(linkReconciliationAction, { success: t("linked"), onSuccess: () => setExpenseId("") });
  const unlink = useServerAction(unlinkReconciliationAction, { success: t("unlinked") });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t("reconcileHint")}</p>
      {links.length > 0 && (
        <ul className="space-y-2">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{l.label}</span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge tone={l.type === "DUPLICATE_OF" ? "copper" : "neutral"} dot={false}>{l.type === "DUPLICATE_OF" ? "≡" : "↔"}</Badge>
                <Button variant="ghost" size="icon-sm" aria-label={t("unlink")} onClick={() => unlink.run({ id: l.id, invoiceId })}><Unlink /></Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {link.error && <Alert tone="danger">{link.error}</Alert>}
      <div className="grid gap-3">
        <Field label={t("reconcileExpense")}>
          <Select value={expenseId} onChange={(e) => setExpenseId(e.target.value)}>
            <option value="">—</option>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </Field>
        <Field label={t("reconcileType")}>
          <Select value={type} onChange={(e) => setType(e.target.value as "DUPLICATE_OF")}>
            <option value="DUPLICATE_OF">{t("DUPLICATE_OF")}</option>
            <option value="RELATED">{t("RELATED")}</option>
          </Select>
        </Field>
        <Button variant="secondary" disabled={!expenseId || link.pending} onClick={() => link.run({ expenseId, invoiceId, type })}>
          {link.pending ? <Loader2 className="animate-spin" /> : <Link2 />} {t("reconcile")}
        </Button>
      </div>
    </div>
  );
}
