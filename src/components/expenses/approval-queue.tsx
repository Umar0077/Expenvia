"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { sum } from "@/lib/finance/money";
import { formatMoney } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";
import { CheckCheck, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, STATUS_TONE } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { useServerAction } from "@/components/ui/use-action";
import { reviewExpensesAction } from "@/server/actions/expenses";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/motion";

export interface QueueItem {
  id: string;
  number: string;
  title: string;
  owner: string;
  branch: string;
  amountLabel: string;
  amount: string;
  currency: string;
  dateLabel: string;
  status: string;
  attachments: number;
}

/** Pending expense queue with safe bulk approval (approve-only; rejections are individual). */
export function ApprovalQueue({ items, selectedId, statusLabels }: { items: QueueItem[]; selectedId?: string; statusLabels: Record<string, string> }) {
  const locale = useLocale() as AppLocale;
  const totalLabel = (ids: string[]) => {
    const byCur = new Map<string, string[]>();
    for (const i of items.filter((x) => ids.includes(x.id))) byCur.set(i.currency, [...(byCur.get(i.currency) ?? []), i.amount]);
    return [...byCur].map(([c, a]) => formatMoney(sum(a).toFixed(2), c, locale)).join(" + ");
  };
  const t = useTranslations("approvals");
  const tc = useTranslations("common");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const all = items.length > 0 && selected.length === items.length;
  const bulk = useServerAction(reviewExpensesAction, {
    success: t("approvedToast", { count: selected.length }),
    onSuccess: () => {
      setSelected([]);
      setConfirm(false);
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <label className="flex items-center gap-2.5 text-sm text-muted">
          <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={all} onChange={() => setSelected(all ? [] : items.map((i) => i.id))} aria-label={t("selectAll")} />
          {selected.length > 0 ? t("selected", { count: selected.length }) : t("selectAll")}
        </label>
        <AnimatePresence>
          {selected.length > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: duration.micro }}>
              <Button size="sm" onClick={() => setConfirm(true)}><CheckCheck /> {t("approveSelected")}</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <ul className="divide-y divide-border">
        {items.map((i) => (
          <li key={i.id} className={cn("flex items-center gap-3 px-4 transition-colors", i.id === selectedId ? "bg-brand-soft/50" : "hover:bg-surface-2/50")}>
            <input type="checkbox" className="size-4 shrink-0 accent-[var(--brand)]" checked={selected.includes(i.id)} onChange={() => toggle(i.id)} aria-label={`${i.number} ${i.title}`} />
            <Link href={`?id=${i.id}`} scroll={false} className="flex min-w-0 flex-1 items-center gap-3 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.title}</p>
                <p className="truncate text-xs text-muted">
                  {i.owner} · {i.branch} · {i.dateLabel}
                  {i.attachments > 0 && <Paperclip className="ms-1 inline size-3" />}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <p className="tabular text-sm font-semibold" dir="ltr">{i.amountLabel}</p>
                <Badge tone={STATUS_TONE[i.status]} className="mt-0.5">{statusLabels[i.status]}</Badge>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        size="sm"
        title={t("bulkConfirmTitle", { count: selected.length })}
        description={t("bulkConfirmBody", { amount: totalLabel(selected) })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>{tc("cancel")}</Button>
            <Button disabled={bulk.pending} onClick={() => bulk.run({ ids: selected, decision: "APPROVED", note: "" })}>
              {bulk.pending && <Loader2 className="animate-spin" />} {t("approveSelected")}
            </Button>
          </>
        }
      />
    </div>
  );
}
