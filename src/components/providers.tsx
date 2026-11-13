"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import { ToastProvider } from "@/components/ui/toast";

function MotionRoot({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  // Pause decorative CSS motion (ambient background) while the tab is hidden.
  useEffect(() => {
    const sync = () => document.documentElement.toggleAttribute("data-tab-hidden", document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  // Resolved from OS setting + in-app preference (see useReducedMotion).
  return <MotionConfig reducedMotion={reduced ? "always" : "never"}>{children}</MotionConfig>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // next-themes injects a blocking script that sets the class before paint → no theme flash.
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="expenvia-theme">
      <MotionRoot>
        <ToastProvider>{children}</ToastProvider>
      </MotionRoot>
    </ThemeProvider>
  );
}
