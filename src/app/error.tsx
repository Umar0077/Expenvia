"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { StatusScreen } from "@/components/status-screen";
import { Button } from "@/components/ui/button";

// Never renders stack traces; the digest lets support correlate with server logs.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  const tc = useTranslations("common");
  return (
    <StatusScreen icon={AlertTriangle} tone="danger" title={t("genericTitle")} body={t("genericBody")} action={<Button onClick={reset}>{tc("retry")}</Button>} />
  );
}
