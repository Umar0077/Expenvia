"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";

type Result = { ok: true; data?: unknown } | { ok: false; error: string; fields?: Record<string, string> };

/**
 * Runs a server action, shows a translated toast, refreshes server data on
 * success. Success is only reported after the server confirms persistence.
 */
export function useServerAction<I>(action: (input: I) => Promise<Result>, opts: { success?: string; onSuccess?: (r: Result) => void } = {}) {
  const [pending, start] = useTransition();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const router = useRouter();
  const toast = useToast();
  const te = useTranslations("actionErrors");

  const run = (input: I) =>
    start(async () => {
      setError(undefined);
      setFields({});
      const res = await action(input);
      if (res.ok) {
        if (opts.success) toast(opts.success, "success");
        opts.onSuccess?.(res);
        router.refresh();
      } else {
        const msg = te.has(res.error as never) ? te(res.error as never) : te("unexpected");
        setError(msg);
        setFields(res.fields ?? {});
        if (!res.fields) toast(msg, "error");
        if (res.error === "alreadyProcessed" || res.error === "staleRecord") router.refresh();
      }
    });

  return { run, pending, error, fields };
}
