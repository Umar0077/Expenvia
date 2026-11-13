"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useServerAction } from "@/components/ui/use-action";
import { retryEmailAction } from "@/server/actions/email";

export function EmailRefresh() {
  const router = useRouter(), t = useTranslations("emailDelivery");
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) router.refresh(); }, 15_000);
    return () => clearInterval(timer);
  }, [router]);
  return <Button variant="secondary" onClick={() => router.refresh()}>{t("refresh")}</Button>;
}
export function EmailRetry({ id }: { id: string }) {
  const t = useTranslations("emailDelivery");
  const action = useServerAction(retryEmailAction, { success: t("retryQueued") });
  return <Button size="sm" variant="secondary" disabled={action.pending} onClick={() => action.run({ id })}>{t("retry")}</Button>;
}
