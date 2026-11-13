"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Briefcase, Loader2, ShieldCheck, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, PasswordInput } from "@/components/ui/form";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { devQuickAccessAction } from "@/server/actions/dev-access";

type Role = "SUPER_ADMIN" | "USER" | "VENDOR";

export function DevAccessForm() {
  const t = useTranslations("devAccess");
  const ta = useTranslations("auth");
  const [pending, start] = useTransition();
  const [v, setV] = useState({ fullName: "", email: "", password: "", role: "SUPER_ADMIN" as Role });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();

  const roles: { v: Role; icon: typeof ShieldCheck; title: string; body: string }[] = [
    { v: "SUPER_ADMIN", icon: ShieldCheck, title: t("roleAdmin"), body: t("roleAdminBody") },
    { v: "USER", icon: Briefcase, title: t("roleUser"), body: t("roleUserBody") },
    { v: "VENDOR", icon: Store, title: t("roleVendor"), body: t("roleVendorBody") },
  ];

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(undefined);
          setFields({});
          const res = await devQuickAccessAction(v);
          if (!res.ok) {
            setFields(res.fields ?? {});
            if (res.error) setError(ta(res.error as never));
          }
        });
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("role")}</legend>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
          {roles.map((r) => {
            const active = v.role === r.v;
            return (
              <button
                key={r.v}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${r.title} — ${r.body}`}
                onClick={() => setV({ ...v, role: r.v })}
                className={cn("relative rounded-[var(--radius-lg)] border p-3 text-start transition-colors", active ? "border-brand bg-brand-soft/60" : "border-border bg-surface hover:border-border-strong")}
              >
                {active && <motion.span layoutId="dev-role" transition={spring.soft} className="absolute inset-0 rounded-[var(--radius-lg)] ring-2 ring-brand/70" />}
                <r.icon className={cn("size-5", active ? "text-brand" : "text-muted")} />
                <span className="mt-1.5 block text-sm font-semibold">{r.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">{r.body}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <Field label={ta("fullName")} error={fields.fullName} required>
        <Input value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} autoComplete="name" />
      </Field>
      <Field label={ta("email")} error={fields.email} required>
        <Input type="email" dir="ltr" className="text-start" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} autoComplete="email" />
      </Field>
      <Field label={ta("password")} hint={t("passwordHint")} error={fields.password} required>
        <PasswordInput value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} autoComplete="new-password" />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} {t("submit")}
      </Button>
    </form>
  );
}
