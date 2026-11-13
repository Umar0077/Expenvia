"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, MessageSquareMore, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useServerAction } from "@/components/ui/use-action";
import { approveRegistrationAction, rejectRegistrationAction, requestInfoAction } from "@/server/actions/registrations";
import { cn } from "@/lib/cn";

interface BranchOpt {
  id: string;
  name: string;
  code: string;
  city: string;
}

export function RegistrationActions({ id, name, type, branches }: { id: string; name: string; type: "USER" | "VENDOR"; branches: BranchOpt[] }) {
  const t = useTranslations("registrations");
  const tc = useTranslations("common");
  const [open, setOpen] = useState<"approve" | "reject" | "info" | null>(null);
  const [branchId, setBranchId] = useState("");
  const [vendorBranches, setVendorBranches] = useState<string[]>([]);
  const [publicMessage, setPublicMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const close = () => setOpen(null);

  const approve = useServerAction(approveRegistrationAction, { success: t("approved"), onSuccess: close });
  const reject = useServerAction(rejectRegistrationAction, { success: t("rejected"), onSuccess: close });
  const info = useServerAction(requestInfoAction, { success: t("infoSent"), onSuccess: close });

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen("approve")} className="flex-1">
          <Check /> {t("approve")}
        </Button>
        <Button variant="secondary" onClick={() => setOpen("info")}>
          <MessageSquareMore /> {t("requestInfo")}
        </Button>
        <Button variant="secondary" className="text-danger" onClick={() => setOpen("reject")}>
          <X /> {t("reject")}
        </Button>
      </div>

      <Modal
        open={open === "approve"}
        onOpenChange={(o) => !o && close()}
        title={t("approveTitle", { name })}
        description={type === "USER" ? t("approveBodyUser") : t("approveBodyVendor")}
        footer={
          <>
            <Button variant="ghost" onClick={close}>{tc("cancel")}</Button>
            <Button
              disabled={approve.pending}
              onClick={() => approve.run({ id, branchIds: type === "USER" ? (branchId ? [branchId] : []) : vendorBranches })}
            >
              {approve.pending && <Loader2 className="animate-spin" />} {t("approve")}
            </Button>
          </>
        }
      >
        {approve.error && <Alert tone="danger" className="mb-4">{approve.error}</Alert>}
        {branches.length === 0 ? (
          <Alert tone="info">{t("noBranches")}</Alert>
        ) : type === "USER" ? (
          <Field label={t("branch")}>
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t("noBranchYet")}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.code} · {b.city}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("branches")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {branches.map((b) => {
                const on = vendorBranches.includes(b.id);
                return (
                  <label
                    key={b.id}
                    className={cn("flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-sm transition-colors", on ? "border-brand bg-brand-soft/50" : "border-border hover:border-border-strong")}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setVendorBranches((v) => (on ? v.filter((x) => x !== b.id) : [...v, b.id]))}
                      className="size-4 accent-[var(--brand)]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{b.name}</span>
                      <span className="block text-xs text-muted">{b.code} · {b.city}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
      </Modal>

      <Modal
        open={open === "reject"}
        onOpenChange={(o) => !o && close()}
        title={t("rejectTitle", { name })}
        description={t("rejectBody")}
        footer={
          <>
            <Button variant="ghost" onClick={close}>{tc("cancel")}</Button>
            <Button variant="danger" disabled={reject.pending} onClick={() => reject.run({ id, publicMessage, internalNote })}>
              {reject.pending && <Loader2 className="animate-spin" />} {t("reject")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t("publicMessage")} error={reject.fields.publicMessage}>
            <Textarea value={publicMessage} onChange={(e) => setPublicMessage(e.target.value)} />
          </Field>
          <Field label={t("internalNote")} error={reject.fields.internalNote}>
            <Textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={open === "info"}
        onOpenChange={(o) => !o && close()}
        title={t("infoTitle")}
        description={t("infoBody")}
        footer={
          <>
            <Button variant="ghost" onClick={close}>{tc("cancel")}</Button>
            <Button disabled={info.pending} onClick={() => info.run({ id, publicMessage })}>
              {info.pending && <Loader2 className="animate-spin" />} {t("requestInfo")}
            </Button>
          </>
        }
      >
        <Field label={t("infoMessage")} error={info.fields.publicMessage} required>
          <Textarea value={publicMessage} onChange={(e) => setPublicMessage(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}
