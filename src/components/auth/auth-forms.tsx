"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm, type FieldValues, type Path, type UseFormSetError } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Briefcase, Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Checkbox, Field, Input, PasswordInput, Textarea } from "@/components/ui/form";
import { forgotSchema, resetSchema, signInSchema, signUpSchema, type SignUpInput } from "@/lib/validation/auth";
import { duration, ease, spring } from "@/lib/motion";
import { cn } from "@/lib/cn";
import {
  forgotPasswordAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type FormResult,
} from "@/server/actions/auth";

function applyResult<T extends FieldValues>(res: FormResult, setError: UseFormSetError<T>): string | undefined {
  if (res.ok) return undefined;
  if (res.fields) for (const [k, v] of Object.entries(res.fields)) setError(k as Path<T>, { message: v });
  return res.error;
}

function Submit({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? pendingLabel : label}
    </Button>
  );
}

// ───────────────────────── Sign in ─────────────────────────
export function SignInForm() {
  const t = useTranslations("auth");
  const [pending, start] = useTransition();
  const [error, setFormError] = useState<string>();
  const { register, handleSubmit, setError, formState } = useForm({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) =>
        start(async () => {
          setFormError(undefined);
          const res = await signInAction(values);
          setFormError(applyResult(res, setError));
        }),
      )}
      className="space-y-5"
    >
      {error && <Alert tone="danger">{t(error as never)}</Alert>}
      <Field label={t("email")} error={formState.errors.email?.message} required>
        <Input type="email" autoComplete="email" dir="ltr" className="text-start" {...register("email")} />
      </Field>
      <Field label={t("password")} error={formState.errors.password?.message} required>
        <PasswordInput autoComplete="current-password" {...register("password")} />
      </Field>
      <div className="-mt-1 flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-brand hover:underline">
          {t("forgot")}
        </Link>
      </div>
      <Submit pending={pending} label={t("signIn")} pendingLabel={t("signingIn")} />
      <p className="text-center text-sm text-muted">
        {t("noAccount")}{" "}
        <Link href="/signup" className="font-medium text-brand hover:underline">
          {t("requestAccess")}
        </Link>
      </p>
    </form>
  );
}

// ───────────────────────── Sign up ─────────────────────────
export function SignUpForm() {
  const t = useTranslations("auth");
  const [pending, start] = useTransition();
  const [error, setFormError] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      accountType: "USER",
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      businessName: "",
      businessAddress: "",
      businessCategory: "",
      taxIdentifier: "",
      applicantNote: "",
      acceptTerms: false,
    },
  });
  const { register, handleSubmit, setError, formState, watch, setValue } = form;
  const type = watch("accountType");
  const e = formState.errors;

  if (submitted) return <div className="space-y-4"><Alert tone="success">{t("registrationNeutral")}</Alert><Link href="/login" className="text-brand hover:underline">{t("backToSignIn")}</Link></div>;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) =>
        start(async () => {
          setFormError(undefined);
          const res = await signUpAction(values);
          if (res.ok) setSubmitted(true);
          setFormError(applyResult(res, setError));
        }),
      )}
      className="space-y-5"
    >
      {error && <Alert tone="danger">{t(error as never)}</Alert>}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("accountType")}</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-3">
          {(
            [
              { v: "USER", icon: Briefcase, title: t("typeUser"), body: t("typeUserBody") },
              { v: "VENDOR", icon: Store, title: t("typeVendor"), body: t("typeVendorBody") },
            ] as const
          ).map((o) => {
            const active = type === o.v;
            return (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${o.title} — ${o.body}`}
                onClick={() => setValue("accountType", o.v, { shouldValidate: formState.isSubmitted })}
                className={cn(
                  "relative rounded-[var(--radius-lg)] border p-3.5 text-start transition-colors duration-150",
                  active ? "border-brand bg-brand-soft/60" : "border-border bg-surface hover:border-border-strong",
                )}
              >
                {active && (
                  <motion.span layoutId="signup-type" transition={spring.soft} className="absolute inset-0 rounded-[var(--radius-lg)] ring-2 ring-brand/70" />
                )}
                <o.icon className={cn("size-5", active ? "text-brand" : "text-muted")} />
                <span className="mt-2 block text-sm font-semibold">{o.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">{o.body}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label={t("fullName")} error={e.fullName?.message} required>
        <Input autoComplete="name" {...register("fullName")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("email")} error={e.email?.message} required>
          <Input type="email" autoComplete="email" dir="ltr" className="text-start" {...register("email")} />
        </Field>
        <Field label={type === "VENDOR" ? t("phone") : t("phoneOptional")} error={e.phone?.message} required={type === "VENDOR"}>
          <Input type="tel" autoComplete="tel" dir="ltr" className="text-start" {...register("phone")} />
        </Field>
      </div>

      <AnimatePresence initial={false}>
        {type === "VENDOR" && (
          <motion.div
            key="vendor"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: duration.panel, ease: ease.out }}
            className="overflow-hidden"
          >
            <div className="space-y-5 rounded-[var(--radius-lg)] border border-border bg-surface-2/60 p-4">
              <Field label={t("businessName")} error={e.businessName?.message} required>
                <Input autoComplete="organization" {...register("businessName")} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t("businessCategory")} error={e.businessCategory?.message}>
                  <Input {...register("businessCategory")} />
                </Field>
                <Field label={t("taxId")} error={e.taxIdentifier?.message}>
                  <Input dir="ltr" className="text-start" {...register("taxIdentifier")} />
                </Field>
              </div>
              <Field label={t("businessAddress")} error={e.businessAddress?.message}>
                <Input autoComplete="street-address" {...register("businessAddress")} />
              </Field>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("password")} error={e.password?.message} hint={t("passwordHint")} required>
          <PasswordInput autoComplete="new-password" {...register("password")} />
        </Field>
        <Field label={t("confirmPassword")} error={e.confirmPassword?.message} required>
          <PasswordInput autoComplete="new-password" {...register("confirmPassword")} />
        </Field>
      </div>
      <Field label={t("applicantNote")} error={e.applicantNote?.message}>
        <Textarea rows={2} {...register("applicantNote")} />
      </Field>
      <Checkbox label={t("terms")} error={e.acceptTerms?.message} {...register("acceptTerms")} />

      <Submit pending={pending} label={t("signUp")} pendingLabel={t("signingUp")} />
      <p className="text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}

// ───────────────────────── Forgot / Reset ─────────────────────────
export function ForgotForm() {
  const t = useTranslations("auth");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FormResult>();
  const { register, handleSubmit, setError, formState } = useForm({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });

  if (result?.ok) return <Alert tone="success">{t("forgotDone")}</Alert>;
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit((v) =>
        start(async () => {
          const res = await forgotPasswordAction(v);
          applyResult(res, setError);
          setResult(res);
        }),
      )}
    >
      {result && !result.ok && result.error && <Alert tone="danger">{t(result.error as never)}</Alert>}
      <Field label={t("email")} error={formState.errors.email?.message} required>
        <Input type="email" autoComplete="email" dir="ltr" className="text-start" {...register("email")} />
      </Field>
      <Submit pending={pending} label={t("sendReset")} pendingLabel={t("sendReset")} />
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FormResult>();
  const { register, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  if (result?.ok)
    return (
      <div className="space-y-5">
        <Alert tone="success">{t("resetDone")}</Alert>
        <Button asChild size="lg" className="w-full">
          <Link href="/login">{t("signIn")}</Link>
        </Button>
      </div>
    );
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit((v) =>
        start(async () => {
          const res = await resetPasswordAction(v);
          applyResult(res, setError);
          setResult(res);
        }),
      )}
    >
      {result && !result.ok && result.error && <Alert tone="danger">{t(result.error as never)}</Alert>}
      <input type="hidden" {...register("token")} />
      <Field label={t("newPassword")} error={formState.errors.password?.message} hint={t("passwordHint")} required>
        <PasswordInput autoComplete="new-password" {...register("password")} />
      </Field>
      <Field label={t("confirmPassword")} error={formState.errors.confirmPassword?.message} required>
        <PasswordInput autoComplete="new-password" {...register("confirmPassword")} />
      </Field>
      <Submit pending={pending} label={t("resetSubmit")} pendingLabel={t("resetSubmit")} />
    </form>
  );
}
