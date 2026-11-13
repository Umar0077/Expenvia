"use client";

import { useEffect, useId, useRef } from "react";
import { motion, useAnimate } from "motion/react";
import { cn } from "@/lib/cn";
import { duration, spring } from "@/lib/motion";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";

export interface JellyToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label. Use `aria-label` instead when the label is rendered elsewhere. */
  label?: React.ReactNode;
  description?: React.ReactNode;
  "aria-label"?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  name?: string;
}

const SIZES = {
  sm: { track: "h-5 w-9", thumb: 14, pad: 3, width: 36 },
  md: { track: "h-7 w-12", thumb: 20, pad: 4, width: 48 },
} as const;

/**
 * JellyToggle — spring-driven switch with a four-phase jelly motion:
 * 1) thumb departs, 2) stretches along travel, 3) compresses on arrival, 4) settles.
 * Direction-aware (mirrors in RTL) and collapses to a plain slide under reduced motion.
 */
export function JellyToggle({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  size = "md",
  className,
  name,
  ...rest
}: JellyToggleProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const first = useRef(true);
  const s = SIZES[size];
  const travel = s.width - s.thumb - s.pad * 2;

  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    const x = (checked ? travel : 0) * (rtl ? -1 : 1);

    if (first.current || reduced) {
      first.current = false;
      animate(el, { x, scaleX: 1, scaleY: 1 }, { duration: reduced ? duration.micro : 0 });
      return;
    }

    animate(el, { x }, spring.jelly);
    animate(
      el,
      // rest → stretch (in flight) → squash (arrival) → settle
      { scaleX: [1, 1.32, 0.88, 1.04, 1], scaleY: [1, 0.84, 1.1, 0.98, 1] },
      { duration: 0.42, times: [0, 0.3, 0.62, 0.82, 1], ease: "easeOut" },
    );
  }, [checked, reduced, travel, animate, scope]);

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      {(label || description) && (
        <label htmlFor={id} className={cn("min-w-0 flex-1", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
          {label && <span className="block text-sm font-medium text-text">{label}</span>}
          {description && <span className="mt-0.5 block text-sm leading-snug text-muted">{description}</span>}
        </label>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        name={name}
        aria-checked={checked}
        aria-label={rest["aria-label"]}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex shrink-0 items-center rounded-full border transition-colors",
          "duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "border-brand bg-brand" : "border-border-strong bg-surface-2",
          s.track,
        )}
        style={{ paddingInline: s.pad - 1 }}
      >
        <motion.span
          ref={scope}
          aria-hidden
          className={cn(
            "block rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-colors duration-200",
            checked ? "bg-brand-fg" : "bg-white dark:bg-muted",
          )}
          style={{ width: s.thumb, height: s.thumb, transformOrigin: "center" }}
        />
      </button>
    </div>
  );
}
