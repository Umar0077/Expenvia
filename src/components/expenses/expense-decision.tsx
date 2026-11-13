"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useServerAction } from "@/components/ui/use-action";
import { reviewExpensesAction } from "@/server/actions/expenses";

type Decision = "APPROVED" | "REJECTED" | "REVISION_REQUESTED";

export function ExpenseDecisionButtons({ id, number, amount, branch }: { id: string; number: string; amount: string; branch: string }) {
  const t = useTranslations("approvals");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const successMsg = open === "APPROVED" ? t("approvedToast", { count: 1 }) : open === "REJECTED" ? t("rejectedToast") : t("revisionToast");
  const act = useServerAction(reviewExpensesAction, {
    success: successMsg,
    onSuccess: () => {
      setOpen(null);
      setNote("");
      router.replace("?", { scroll: false });
    },
  });

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
        description={open === "APPROVED" ? t("approveBody", { amount, branch }) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)}>{tc("cancel")}</Button>
            <Button
              variant={open === "REJECTED" ? "danger" : "primary"}
              disabled={act.pending || (open !== "APPROVED" && note.trim().length < 3)}
              onClick={() => open && act.run({ ids: [id], decision: open, note })}
            >
              {act.pending && <Loader2 className="animate-spin" />}
              {open === "APPROVED" ? t("approve") : open === "REJECTED" ? t("reject") : t("requestRevision")}
            </Button>
          </>
        }
      >
        {act.error && <Alert tone="danger" className="mb-3">{act.error}</Alert>}
        {open !== "APPROVED" && (
          <Field label={t("noteLabel")} required>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          </Field>
        )}
      </Modal>
    </>
  );
}
