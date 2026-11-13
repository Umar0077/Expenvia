"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { duration, ease } from "@/lib/motion";
import { setThemeAction } from "@/server/actions/preferences";

/** Compact header toggle. Full Light/Dark/System choice lives in Settings. */
export function ThemeToggle() {
  const t = useTranslations("preferences");
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const next = isDark ? "light" : "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("toggleTheme", { mode: isDark ? t("themeLight") : t("themeDark") })}
      onClick={() => {
        setTheme(next);
        void setThemeAction(next);
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ opacity: 0, rotate: -40, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 40, scale: 0.7 }}
          transition={{ duration: duration.micro, ease: ease.out }}
          className="grid place-items-center"
        >
          {isDark ? <Moon /> : <Sun />}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
