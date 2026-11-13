"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { History, Loader2, LogOut, Plus, ShieldCheck, ShieldOff, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Select } from "@/components/ui/form";
import { Drawer, Modal } from "@/components/ui/modal";
import { useServerAction } from "@/components/ui/use-action";
import { revokeSessionsAction, setSuspendedAction, vendorBranchAction } from "@/server/actions/org";

interface Props {
  vendor: { id: string; userId: string; businessName: string; email: string; phone: string | null; taxId: string | null; address: string | null; status: string };
  active: { branchId: string; label: string }[];
  branches: { id: string; name: string; code: string }[];
  history: { id: string; branch: string; from: string; to: string | null; by: string }[];
}

export function VendorManager({ vendor, active, branches, history }: Props) {
  const t = useTranslations("vendors");
  const tu = useTranslations("users");
  const tb = useTranslations("branches");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [toAdd, setToAdd] = useState("");
  const [removing, setRemoving] = useState<{ branchId: string; label: string } | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const isActive = vendor.status === "ACTIVE";

  const add = useServerAction(vendorBranchAction, { success: t("added"), onSuccess: () => setToAdd("") });
  const remove = useServerAction(vendorBranchAction, { success: t("removed"), onSuccess: () => setRemoving(null) });
  const suspend = useServerAction(setSuspendedAction, { success: isActive ? tu("suspended") : tu("reactivated"), onSuccess: () => setConfirmSuspend(false) });
  const revoke = useServerAction(revokeSessionsAction, { success: tu("revoked") });

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <SlidersHorizontal /> {t("manage")}
      </Button>
      <Drawer open={open} onOpenChange={setOpen} title={vendor.businessName} description={<span className="ltr-data">{vendor.email}</span>}>
        <div className="space-y-7">
          <dl className="grid gap-2 text-sm">
            {vendor.phone && <div className="flex justify-between gap-4"><dt className="text-muted">{t("contact")}</dt><dd className="ltr-data">{vendor.phone}</dd></div>}
            {vendor.taxId && <div className="flex justify-between gap-4"><dt className="text-muted">{t("taxId")}</dt><dd className="ltr-data">{vendor.taxId}</dd></div>}
          </dl>

          <section>
            <h3 className="text-sm font-semibold">{t("coverage")}</h3>
            {active.length === 0 && <Alert tone="warning" className="mt-3">{t("noBranches")}</Alert>}
            <ul className="mt-3 space-y-2">
              {active.map((a) => (
                <li key={a.branchId} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm">
                  <span className="truncate">{a.label}</span>
                  <Button variant="ghost" size="sm" className="text-muted hover:text-danger" onClick={() => setRemoving(a)}>
                    <X /> {t("remove")}
                  </Button>
                </li>
              ))}
            </ul>
            {branches.length > 0 && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <Field label={t("selectBranch")} className="min-w-0 flex-1">
                  <Select value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
                    <option value="" disabled>—</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </Select>
                </Field>
                <Button className="h-11" disabled={!toAdd || add.pending} onClick={() => add.run({ vendorId: vendor.id, branchId: toAdd, op: "add" })}>
                  {add.pending ? <Loader2 className="animate-spin" /> : <Plus />} {t("addBranch")}
                </Button>
              </div>
            )}
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold"><History className="size-4 text-muted" /> {t("history")}</h3>
            <ol className="mt-3 space-y-2.5 border-s-2 border-border ps-4">
              {history.map((h) => (
                <li key={h.id} className="relative">
                  <span className={`absolute -start-[21px] top-1.5 size-2.5 rounded-full ${h.to ? "bg-border-strong" : "bg-brand"}`} />
                  <p className="text-sm font-medium">{h.branch}</p>
                  <p className="text-xs text-muted">{h.to ? tb("ended", { from: h.from, to: h.to }) : tb("since", { date: h.from })} · {h.by}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="flex flex-wrap gap-2 border-t border-border pt-5">
            <Button variant="secondary" onClick={() => revoke.run({ userId: vendor.userId })} disabled={revoke.pending}>
              <LogOut className="rtl:-scale-x-100" /> {tu("revokeSessions")}
            </Button>
            <Button variant={isActive ? "secondary" : "primary"} className={isActive ? "text-danger" : ""} onClick={() => setConfirmSuspend(true)}>
              {isActive ? <ShieldOff /> : <ShieldCheck />} {isActive ? tu("suspend") : tu("reactivate")}
            </Button>
          </section>
        </div>
      </Drawer>

      <Modal
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        size="sm"
        title={removing ? t("removeTitle", { branch: removing.label, vendor: vendor.businessName }) : ""}
        description={t("removeBody")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>{tc("cancel")}</Button>
            <Button variant="danger" disabled={remove.pending} onClick={() => removing && remove.run({ vendorId: vendor.id, branchId: removing.branchId, op: "remove" })}>
              {remove.pending && <Loader2 className="animate-spin" />} {t("remove")}
            </Button>
          </>
        }
      />
      <Modal
        open={confirmSuspend}
        onOpenChange={setConfirmSuspend}
        size="sm"
        title={isActive ? tu("suspendTitle", { name: vendor.businessName }) : tu("reactivate")}
        description={isActive ? tu("suspendBody") : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmSuspend(false)}>{tc("cancel")}</Button>
            <Button variant={isActive ? "danger" : "primary"} disabled={suspend.pending} onClick={() => suspend.run({ userId: vendor.userId, suspended: isActive })}>
              {suspend.pending && <Loader2 className="animate-spin" />} {isActive ? tu("suspend") : tu("reactivate")}
            </Button>
          </>
        }
      />
    </>
  );
}
