"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Laptop, Loader2, LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, PasswordInput } from "@/components/ui/form";
import { JellyToggle } from "@/components/ui/jelly-toggle";
import { LanguageSwitcher } from "@/components/preferences/language-switcher";
import { useServerAction } from "@/components/ui/use-action";
import { useToast } from "@/components/ui/toast";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { setMotionAction, setThemeAction } from "@/server/actions/preferences";
import { changePasswordAction, saveSystemSettingsAction, signOutOtherSessionsAction, updateNotificationPrefsAction, updateProfileAction } from "@/server/actions/account";

export function Section({ title, body, children }: { title: string; body?: string; children: React.ReactNode }) {
  return (
    <section className="surface-card grid gap-4 p-4 sm:p-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-section font-semibold tracking-[-0.01em]">{title}</h2>
        {body && <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string; email: string }) {
  const t = useTranslations("settings");
  const [name, setName] = useState(fullName);
  const [tel, setTel] = useState(phone);
  const a = useServerAction(updateProfileAction, { success: t("profileSaved") });
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); a.run({ fullName: name, phone: tel }); }}>
      <Field label={t("fullName")} error={a.fields.fullName} required><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
      <Field label={t("phone")} error={a.fields.phone}><Input value={tel} onChange={(e) => setTel(e.target.value)} type="tel" dir="ltr" className="text-start" /></Field>
      <Field label={t("email")} hint={t("emailHint")} className="sm:col-span-2"><Input value={email} disabled dir="ltr" className="text-start" /></Field>
      <div className="sm:col-span-2"><Button type="submit" disabled={a.pending}>{a.pending && <Loader2 className="animate-spin" />} {t("saveProfile")}</Button></div>
    </form>
  );
}

/** Light / Dark / System — a three-way segmented control with a shared spring indicator. */
export function AppearancePicker() {
  const tp = useTranslations("preferences");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const opts = [
    { v: "light", l: tp("themeLight"), i: Sun },
    { v: "dark", l: tp("themeDark"), i: Moon },
    { v: "system", l: tp("themeSystem"), i: Laptop },
  ] as const;
  return (
    <div role="radiogroup" aria-label={tp("theme")} className="grid max-w-md grid-cols-3 gap-1 rounded-[var(--radius-lg)] border border-border bg-surface-2 p-1">
      {opts.map((o) => {
        const active = mounted && theme === o.v;
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => { setTheme(o.v); void setThemeAction(o.v); }}
            className={cn("relative flex items-center justify-center gap-2 rounded-[var(--radius-md)] py-2.5 text-sm font-medium transition-colors", active ? "text-text" : "text-muted hover:text-text")}
          >
            {active && <motion.span layoutId="theme-pick" transition={spring.soft} className="absolute inset-0 rounded-[var(--radius-md)] bg-surface shadow-[var(--shadow-card)]" />}
            <o.i className="relative size-4" /> <span className="relative">{o.l}</span>
          </button>
        );
      })}
    </div>
  );
}

export function LanguagePicker() {
  return <LanguageSwitcher />;
}

export function MotionToggles({ initial }: { initial: "full" | "reduced" | "system" }) {
  const t = useTranslations("settings");
  const toast = useToast();
  const [value, setValue] = useState(initial);
  const apply = async (v: "full" | "reduced" | "system") => {
    setValue(v);
    document.documentElement.dataset.motion = v; // instant, no reload
    const r = await setMotionAction(v);
    if (r.ok) toast(t("saved"));
  };
  return (
    <div className="space-y-5">
      <JellyToggle label={t("followSystemMotion")} description={t("followSystemMotionBody")} checked={value === "system"} onCheckedChange={(on) => apply(on ? "system" : "full")} />
      <JellyToggle label={t("reduceMotion")} description={t("reduceMotionBody")} checked={value === "reduced"} disabled={value === "system"} onCheckedChange={(on) => apply(on ? "reduced" : "full")} />
    </div>
  );
}

type PrefKey = "notifyExpenseUpdates" | "notifyInvoiceUpdates" | "notifyAccountUpdates" | "emailExpenseUpdates" | "emailInvoiceUpdates" | "emailBranchUpdates" | "emailActivityUpdates";

function PrefToggle({ k, label, body, initial }: { k: PrefKey; label: string; body: string; initial: boolean }) {
  const t = useTranslations("settings");
  const toast = useToast();
  const [, start] = useTransition();
  const [value, setValue] = useState(initial);
  const [optimistic, setOptimistic] = useOptimistic(value);
  return (
    <JellyToggle
      label={label}
      description={body}
      checked={optimistic}
      onCheckedChange={(next) =>
        start(async () => {
          setOptimistic(next);
          const r = await updateNotificationPrefsAction({ key: k, value: next });
          if (r.ok) { setValue(next); toast(t("saved")); }
        })
      }
    />
  );
}

export function NotificationPrefs({ prefs, show }: { prefs: Record<PrefKey, boolean>; show: PrefKey[] }) {
  const t = useTranslations("settings");
  const meta: Record<PrefKey, [string, string]> = {
    notifyExpenseUpdates: [t("notifyExpense"), t("notifyExpenseBody")],
    notifyInvoiceUpdates: [t("notifyInvoice"), t("notifyInvoiceBody")],
    notifyAccountUpdates: [t("notifyAccount"), t("notifyAccountBody")],
    emailExpenseUpdates: [t("emailExpense"), t("emailExpenseBody")],
    emailInvoiceUpdates: [t("emailInvoice"), t("emailInvoiceBody")],
    emailBranchUpdates: [t("emailBranch"), t("emailBranchBody")],
    emailActivityUpdates: [t("emailActivity"), t("emailActivityBody")],
  };
  return (
    <div className="space-y-5">
      {show.map((k) => <PrefToggle key={k} k={k} label={meta[k][0]} body={meta[k][1]} initial={prefs[k]} />)}
      <Alert tone="info">{t("emailDelivery")}</Alert>
    </div>
  );
}

export function PasswordForm() {
  const t = useTranslations("settings");
  const ta = useTranslations("auth");
  const [v, setV] = useState({ current: "", next: "", confirm: "" });
  const a = useServerAction(changePasswordAction, { success: t("passwordChanged"), onSuccess: () => setV({ current: "", next: "", confirm: "" }) });
  return (
    <form className="grid max-w-md gap-4" onSubmit={(e) => { e.preventDefault(); a.run(v); }}>
      {a.error && !Object.keys(a.fields).length && <Alert tone="danger">{a.error}</Alert>}
      <Field label={t("currentPassword")} error={a.fields.current} required><PasswordInput autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} /></Field>
      <Field label={t("newPassword")} hint={ta("passwordHint")} error={a.fields.next} required><PasswordInput autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} /></Field>
      <Field label={t("confirmPassword")} error={a.fields.confirm} required><PasswordInput autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} /></Field>
      <div><Button type="submit" disabled={a.pending}>{a.pending && <Loader2 className="animate-spin" />} {t("changePassword")}</Button></div>
    </form>
  );
}

export function SessionList({ sessions }: { sessions: { id: string; current: boolean; agent: string; lastSeen: string }[] }) {
  const t = useTranslations("settings");
  const a = useServerAction(signOutOtherSessionsAction, { success: t("othersSignedOut") });
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium">{s.agent}</span>
              <span className="text-xs text-muted">{t("lastSeen", { time: s.lastSeen })}</span>
            </span>
            {s.current && <span className="shrink-0 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">{t("thisDevice")}</span>}
          </li>
        ))}
      </ul>
      {sessions.length > 1 && <Button variant="secondary" disabled={a.pending} onClick={() => a.run(undefined as never)}><LogOut className="rtl:-scale-x-100" /> {t("signOutOthers")}</Button>}
    </div>
  );
}

export function SystemSettingsForm({ orgName }: { orgName: string }) {
  const t = useTranslations("settings.system");
  const tc = useTranslations("common");
  const router = useRouter();
  const [name, setName] = useState(orgName);
  const a = useServerAction(saveSystemSettingsAction, { success: t("saved"), onSuccess: () => router.refresh() });
  return (
    <form className="grid max-w-md gap-4" onSubmit={(e) => { e.preventDefault(); a.run({ orgName: name }); }}>
      <Field label={t("orgName")} error={a.fields.orgName} required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label={t("currency")} hint={t("currencyHint")}><Input value="PKR" disabled dir="ltr" className="text-start" /></Field>
      <div><Button type="submit" disabled={a.pending}>{a.pending && <Loader2 className="animate-spin" />} {tc("save")}</Button></div>
    </form>
  );
}
