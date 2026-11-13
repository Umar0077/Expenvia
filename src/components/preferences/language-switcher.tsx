"use client";

import { useId, useTransition } from "react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import type { AppLocale } from "@/i18n/config";
import { setLocaleAction } from "@/server/actions/preferences";

/**
 * Two-option segmented selector (English | اردو) with a soft spring indicator.
 * Re-renders server components via router.refresh() — no full page reload.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("preferences");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const groupId = useId();

  const options: { value: AppLocale; label: string; lang: string }[] = [
    { value: "en", label: "EN", lang: "en" },
    { value: "ur", label: "اردو", lang: "ur" },
  ];

  const choose = (value: AppLocale) => {
    if (value === locale) return;
    startTransition(async () => {
      const res = await setLocaleAction(value);
      if (res.ok) router.refresh();
    });
  };

  return (
    <div
      role="radiogroup"
      aria-label={t("language")}
      aria-busy={pending}
      className={cn("relative inline-flex h-9 items-center rounded-full border border-border bg-surface-2 p-0.5", className)}
    >
      {options.map((o) => {
        const active = o.value === locale;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            lang={o.lang}
            aria-label={o.value === "en" ? t("english") : t("urdu")}
            onClick={() => choose(o.value)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                e.preventDefault();
                choose(o.value === "en" ? "ur" : "en");
              }
            }}
            tabIndex={active ? 0 : -1}
            className={cn(
              "relative z-10 h-full min-w-11 rounded-full px-3 text-sm font-medium transition-colors duration-150",
              active ? "text-brand-fg" : "text-muted hover:text-text",
              o.value === "ur" && "font-[family-name:var(--font-urdu-ui)] leading-none",
            )}
          >
            {active && (
              <motion.span
                layoutId={`${groupId}-indicator`}
                transition={spring.soft}
                className="absolute inset-0 -z-10 rounded-full bg-brand shadow-[var(--shadow-card)]"
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
