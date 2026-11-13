"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/form";
import { refreshStatusAction, resendVerificationAction, signOutAction, verifyEmailAction, type FormResult } from "@/server/actions/auth";

export function SignOutButton() {
  const t = useTranslations("auth");
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" className="w-full">
        <LogOut className="rtl:-scale-x-100" /> {t("signOut")}
      </Button>
    </form>
  );
}

function useAction(fn: () => Promise<FormResult>) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FormResult>();
  return { pending, result, run: () => start(async () => setResult(await fn())) };
}

function ResultAlert({ result }: { result?: FormResult }) {
  const t = useTranslations("auth");
  if (!result) return null;
  if (result.ok) return result.message ? <Alert tone="success">{t(result.message as never)}</Alert> : null;
  return <Alert tone="danger">{t((result.error ?? "genericError") as never)}</Alert>;
}

export function RefreshStatusButton() {
  const t = useTranslations("auth");
  const { pending, result, run } = useAction(refreshStatusAction);
  return (
    <div className="space-y-3">
      <ResultAlert result={result} />
      <Button size="lg" className="w-full" onClick={run} disabled={pending} aria-busy={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        {pending ? t("checking") : t("refreshStatus")}
      </Button>
    </div>
  );
}

export function ResendVerificationButton() {
  const t = useTranslations("auth");
  const { pending, result, run } = useAction(resendVerificationAction);
  return (
    <div className="space-y-3">
      <ResultAlert result={result} />
      <Button variant="secondary" size="lg" className="w-full" onClick={run} disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} {t("verifyResend")}
      </Button>
    </div>
  );
}

/** Verification requires an explicit click (POST), so link scanners can't consume tokens. */
export function ConfirmVerificationButton({ token }: { token: string }) {
  const t = useTranslations("auth");
  const { pending, result, run } = useAction(() => verifyEmailAction(token));
  if (result?.ok) return <ResultAlert result={result} />;
  return (
    <div className="space-y-3">
      <ResultAlert result={result} />
      <Button size="lg" className="w-full" onClick={run} disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} {t("verifyButton")}
      </Button>
    </div>
  );
}
