"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { duration, ease } from "@/lib/motion";

/** Vertical stage visualization for the pending-approval screen. No invented ETAs. */
export function ApprovalTimeline({ stages, current }: { stages: { label: string; meta?: string }[]; current: number }) {
  return (
    <ol className="relative space-y-0">
      {stages.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.label} className="relative flex gap-4 pb-6 last:pb-0">
            {i < stages.length - 1 && (
              <span aria-hidden className="absolute start-[15px] top-8 h-[calc(100%-24px)] w-0.5 overflow-hidden rounded bg-border">
                <motion.span
                  className="block w-full origin-top bg-brand"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: done ? 1 : 0 }}
                  transition={{ duration: duration.hero, ease: ease.out, delay: 0.15 * i }}
                  style={{ height: "100%" }}
                />
              </span>
            )}
            <span
              className={cn(
                "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold",
                done && "border-brand bg-brand text-brand-fg",
                active && "border-copper bg-copper-soft text-copper",
                !done && !active && "border-border bg-surface text-muted",
              )}
            >
              {done ? <Check className="size-4" /> : i + 1}
              {active && (
                <motion.span
                  aria-hidden
                  className="absolute inset-[-5px] rounded-full border-2 border-copper/40"
                  animate={{ scale: [1, 1.18, 1], opacity: [0.8, 0, 0.8] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </span>
            <div className="pt-1">
              <p className={cn("text-sm font-medium", !done && !active && "text-muted")}>{s.label}</p>
              {s.meta && <p className="mt-0.5 text-xs text-muted">{s.meta}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
