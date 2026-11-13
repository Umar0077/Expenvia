"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { History, Loader2, LogOut, ShieldCheck, ShieldOff, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Select } from "@/components/ui/form";
import { Drawer, Modal } from "@/components/ui/modal";
import { useServerAction } from "@/components/ui/use-action";
import { assignEmployeeBranchAction, revokeSessionsAction, setSuspendedAction } from "@/server/actions/org";

interface Props {
  user: { id: string; fullName: string; email: string; status: string; currentBranchId: string | null };
  branches: { id: string; name: string; code: string }[];
  history: { id: string; branch: string; from: string; to: string | null; by: string }[];
  joined: string;
}

export function EmployeeManager({ user, branches, history }: Props) {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const tb = useTranslations("branches");
  const [open, setOpen] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [branchId, setBranchId] = useState(user.currentBranchId ?? "");

  const assign = useServerAction(assignEmployeeBranchAction, { success: t("assigned") });
  const suspend = useServerAction(setSuspendedAction, {
    success: user.status === "ACTIVE" ? t("suspended") : t("reactivated"),
    onSuccess: () => setConfirmSuspend(false),
  });
  const revoke = useServerAction(revokeSessionsAction, { success: t("revoked") });
  const isActive = user.status === "ACTIVE";

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <SlidersHorizontal /> {t("manage")}
      </Button>
      <Drawer open={open} onOpenChange={setOpen} title={user.fullName} description={<span className="ltr-data">{user.email}</span>}>
        <div className="space-y-7">
          <section>
            <h3 className="text-sm font-semibold">{user.currentBranchId ? t("reassign") : t("assignBranch")}</h3>
            <p className="mt-1 text-sm text-muted">{t("assignHint")}</p>
            {assign.error && <Alert tone="danger" className="mt-3">{assign.error}</Alert>}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label={t("branch")} className="min-w-0 flex-1">
                <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="" disabled>—</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </Select>
              </Field>
              <Button disabled={!branchId || branchId === user.currentBranchId || assign.pending} onClick={() => assign.run({ userId: user.id, branchId })} className="h-11">
                {assign.pending && <Loader2 className="animate-spin" />} {tc("save")}
              </Button>
            </div>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold"><History className="size-4 text-muted" /> {t("history")}</h3>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{t("noHistory")}</p>
            ) : (
              <ol className="mt-3 space-y-2.5 border-s-2 border-border ps-4">
                {history.map((h) => (
                  <li key={h.id} className="relative">
                    <span className={`absolute -start-[21px] top-1.5 size-2.5 rounded-full ${h.to ? "bg-border-strong" : "bg-brand"}`} />
                    <p className="text-sm font-medium">{h.branch}</p>
                    <p className="text-xs text-muted">
                      {h.to ? tb("ended", { from: h.from, to: h.to }) : tb("since", { date: h.from })} · {h.by}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="flex flex-wrap gap-2 border-t border-border pt-5">
            <Button variant="secondary" onClick={() => revoke.run({ userId: user.id })} disabled={revoke.pending}>
              {revoke.pending ? <Loader2 className="animate-spin" /> : <LogOut className="rtl:-scale-x-100" />} {t("revokeSessions")}
            </Button>
            <Button variant={isActive ? "secondary" : "primary"} className={isActive ? "text-danger" : ""} onClick={() => setConfirmSuspend(true)}>
              {isActive ? <ShieldOff /> : <ShieldCheck />} {isActive ? t("suspend") : t("reactivate")}
            </Button>
          </section>
        </div>
      </Drawer>
      <Modal
        open={confirmSuspend}
        onOpenChange={setConfirmSuspend}
        size="sm"
        title={isActive ? t("suspendTitle", { name: user.fullName }) : t("reactivate")}
        description={isActive ? t("suspendBody") : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmSuspend(false)}>{tc("cancel")}</Button>
            <Button variant={isActive ? "danger" : "primary"} disabled={suspend.pending} onClick={() => suspend.run({ userId: user.id, suspended: isActive })}>
              {suspend.pending && <Loader2 className="animate-spin" />} {isActive ? t("suspend") : t("reactivate")}
            </Button>
          </>
        }
      />
    </>
  );
}
