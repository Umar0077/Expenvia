"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useServerAction } from "@/components/ui/use-action";
import { branchSchema, type BranchInput } from "@/lib/validation/org";
import { saveBranchAction, setBranchStatusAction } from "@/server/actions/org";

interface BranchRecord {
  id: string;
  code: string;
  name: string;
  address: string | null;
  city: string;
  country: string;
  contactEmail: string | null;
  contactPhone: string | null;
  managerName: string | null;
  secondaryPhone?: string | null;
  workingDays?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  timezone?: string | null;
}

export function BranchFormButton({ branch, compact }: { branch?: BranchRecord; compact?: boolean }) {
  const t = useTranslations("branches");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const form = useForm<BranchInput>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      code: branch?.code ?? "",
      name: branch?.name ?? "",
      address: branch?.address ?? "",
      city: branch?.city ?? "",
      country: branch?.country ?? "Pakistan",
      contactEmail: branch?.contactEmail ?? "",
      contactPhone: branch?.contactPhone ?? "",
      managerName: branch?.managerName ?? "",
      secondaryPhone: branch?.secondaryPhone ?? "",
      workingDays: (branch?.workingDays ?? "") as "" | "MON_FRI",
      opensAt: branch?.opensAt ?? "",
      closesAt: branch?.closesAt ?? "",
      timezone: branch?.timezone ?? "",
    },
  });
  const save = useServerAction(saveBranchAction, {
    success: branch ? t("updated") : t("created"),
    onSuccess: () => {
      setOpen(false);
      if (!branch) form.reset();
    },
  });
  const e = form.formState.errors;
  const err = (k: keyof BranchInput) => e[k]?.message ?? (save.fields[`data.${k}`] as string | undefined);

  return (
    <>
      {branch ? (
        <Button variant="ghost" size={compact ? "icon-sm" : "sm"} onClick={() => setOpen(true)} aria-label={t("edit")} title={t("edit")}>
          <Pencil />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus /> {t("add")}
        </Button>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title={branch ? t("edit") : t("add")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button type="submit" form={`branch-form-${branch?.id ?? "new"}`} disabled={save.pending}>
              {save.pending && <Loader2 className="animate-spin" />} {tc("save")}
            </Button>
          </>
        }
      >
        <form
          id={`branch-form-${branch?.id ?? "new"}`}
          noValidate
          onSubmit={form.handleSubmit((data) => save.run({ id: branch?.id ?? null, data }))}
          className="grid gap-4 sm:grid-cols-2"
        >
          {save.error && !Object.keys(save.fields).length && <Alert tone="danger" className="sm:col-span-2">{save.error}</Alert>}
          <Field label={t("code")} hint={t("codeHint")} error={err("code")} required>
            <Input dir="ltr" className="text-start uppercase" {...form.register("code")} />
          </Field>
          <Field label={t("name")} error={err("name")} required>
            <Input {...form.register("name")} />
          </Field>
          <Field label={t("city")} error={err("city")} required>
            <Input {...form.register("city")} />
          </Field>
          <Field label={t("country")} error={err("country")} required>
            <Input {...form.register("country")} />
          </Field>
          <Field label={t("address")} error={err("address")} className="sm:col-span-2">
            <Input {...form.register("address")} />
          </Field>
          <Field label={t("manager")} error={err("managerName")}>
            <Input {...form.register("managerName")} />
          </Field>
          <Field label={t("contactPhone")} error={err("contactPhone")}>
            <Input type="tel" dir="ltr" className="text-start" {...form.register("contactPhone")} />
          </Field>
          <Field label={t("contactEmail")} error={err("contactEmail")} className="sm:col-span-2">
            <Input type="email" dir="ltr" className="text-start" {...form.register("contactEmail")} />
          </Field>
          <Field label={t("secondaryPhone")} error={err("secondaryPhone")}><Input type="tel" dir="ltr" {...form.register("secondaryPhone")}/></Field>
          <Field label={t("timezone")} error={err("timezone")}><Input dir="ltr" placeholder="Asia/Karachi" {...form.register("timezone")}/></Field>
          <Field label={t("workingDays")} error={err("workingDays")} className="sm:col-span-2"><Select {...form.register("workingDays")}><option value="">{t("awaitingSchedule")}</option><option value="MON_FRI">{t("monFri")}</option></Select></Field>
          <Field label={t("opensAt")} error={err("opensAt")}><Input type="time" {...form.register("opensAt")}/></Field>
          <Field label={t("closesAt")} hint={t("overnightHint")} error={err("closesAt")}><Input type="time" {...form.register("closesAt")}/></Field>
        </form>
      </Modal>
    </>
  );
}

export function BranchStatusButton({ id, name, status }: { id: string; name: string; status: "ACTIVE" | "INACTIVE" }) {
  const t = useTranslations("branches");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const act = useServerAction(setBranchStatusAction, { success: t("statusChanged"), onSuccess: () => setOpen(false) });
  const deactivating = status === "ACTIVE";
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className={deactivating ? "text-muted hover:text-danger" : "text-success"}>
        <Power /> <span className="hidden sm:inline">{deactivating ? t("deactivate") : t("activate")}</span>
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title={deactivating ? t("deactivateTitle", { name }) : t("activateTitle", { name })}
        description={deactivating ? t("deactivateBody") : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button variant={deactivating ? "danger" : "primary"} disabled={act.pending} onClick={() => act.run({ id, status: deactivating ? "INACTIVE" : "ACTIVE" })}>
              {act.pending && <Loader2 className="animate-spin" />} {deactivating ? t("deactivate") : t("activate")}
            </Button>
          </>
        }
      />
    </>
  );
}
