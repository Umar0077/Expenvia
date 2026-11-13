"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView } from "motion/react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { fadeUp } from "@/lib/motion";
import type { AppLocale } from "@/i18n/config";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";

type Tone = "brand" | "copper" | "warning" | "success" | "danger" | "info";
const TONES: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  copper: "bg-copper-soft text-copper",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

/**
 * AnimatedMetric — counts up ONCE when first visible. The intermediate frames
 * are visual only; the final rendered text is the exact decimal value.
 */
export function AnimatedMetric({ value, currency, className }: { value: string; currency?: string; className?: string }) {
  const locale = useLocale() as AppLocale;
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const fmt = (v: string | number) => (currency ? formatMoney(v, currency, locale) : new Intl.NumberFormat(locale === "ur" ? "ur-PK-u-nu-latn" : "en-PK").format(Number(v)));
  const [text, setText] = useState(() => fmt(value));
  const animated = useRef(false);

  useEffect(() => {
    if (!inView || animated.current || reduced) {
      setText(fmt(value));
      return;
    }
    animated.current = true;
    const target = Number(value);
    if (!Number.isFinite(target) || target === 0) return;
    const controls = animate(0, target, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setText(fmt(currency ? v.toFixed(2) : Math.round(v))),
      onComplete: () => setText(fmt(value)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, reduced, locale]);

  return (
    <span ref={ref} className={cn("tabular", className)} dir="ltr">
      {text}
    </span>
  );
}

/** MetricCard */
export function MetricCard({
  label,
  value,
  currency,
  icon,
  tone = "brand",
  footnote,
  className,
  sparkline,
}: {
  label: string;
  value: string;
  currency?: string;
  /** Rendered icon element, e.g. <Receipt /> (elements serialize across the server/client boundary). */
  icon: React.ReactNode;
  tone?: Tone;
  footnote?: React.ReactNode;
  className?: string;
  sparkline?: number[];
}) {
  return (
    <motion.div variants={fadeUp} data-tone={tone} className={cn("surface-card atelier-metric group relative p-4 transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-[var(--atelier-elevation-2)] sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="metric-label text-muted">{label}</p>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] transition-transform duration-200 group-hover:scale-105 [&_svg]:size-[18px]", TONES[tone])}>
          {icon}
        </span>
      </div>
      <p className="metric-value font-semibold">
        <AnimatedMetric value={value} currency={currency} />
      </p>
      {sparkline && sparkline.length>1 && sparkline.some(v=>v!==0) && <svg aria-hidden="true" viewBox="0 0 240 36" preserveAspectRatio="none" className="atelier-sparkline"><polyline fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" points={sparkline.map((v,i)=>`${i*240/(sparkline.length-1)},${32-(v-Math.min(...sparkline))*28/(Math.max(...sparkline)-Math.min(...sparkline)||1)}`).join(" ")}/></svg>}
      {footnote && <div className="metric-footnote text-sm text-muted">{footnote}</div>}
    </motion.div>
  );
}
