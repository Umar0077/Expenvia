"use client";

import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";

// The surface alone is shaped: content, focus rings and elevation remain unclipped.
const outline = "M54 1H350Q359 1 365 7L393 35Q399 41 399 50V244Q399 299 344 299H12Q1 299 1 288V54Q1 1 54 1Z";
const inset = "M54 7H348Q356 7 361 12L388 39Q393 44 393 51V244Q393 293 344 293H14Q7 293 7 286V54Q7 7 54 7Z";

export function SignatureContourCard({ children, className }: { children: ReactNode; className?: string }) {
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={`signature-contour ${className ?? ""}`}
      initial="rest"
      animate="rest"
      whileHover={reduced ? undefined : "hover"}
      variants={{ rest: { y: 0 }, hover: { y: -4 } }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
    >
      <svg className="signature-contour-face" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${id}-surface`} x1="0" y1="0" x2="1" y2="1">
            <stop className="signature-surface-start" />
            <stop offset="1" className="signature-surface-end" />
          </linearGradient>
          <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="var(--contour-accent)" stopOpacity=".65" />
            <stop offset=".45" stopColor="var(--contour-accent)" stopOpacity=".16" />
            <stop offset="1" stopColor="var(--contour-accent)" stopOpacity=".42" />
          </linearGradient>
          <clipPath id={`${id}-clip`}><path d={outline} /></clipPath>
        </defs>
        <path d={outline} fill={`url(#${id}-surface)`} />
        <g clipPath={`url(#${id}-clip)`} className="signature-surface-etch" fill="none" stroke="var(--contour-accent)" strokeWidth="1">
          <rect x="258" y="-95" width="200" height="200" rx="48" transform="rotate(34 358 5)" />
          <rect x="241" y="-112" width="234" height="234" rx="65" transform="rotate(34 358 5)" />
        </g>
        <path d={outline} fill="none" stroke={`url(#${id}-edge)`} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path className="signature-inset" d={inset} fill="none" stroke="var(--contour-accent)" strokeWidth=".65" vectorEffect="non-scaling-stroke" />
        <path className="signature-corner" d="M322 7H348Q356 7 361 12L388 39Q393 44 393 51V70" fill="none" stroke="var(--contour-accent)" strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <motion.path d={outline} fill="none" stroke="var(--contour-accent)" strokeWidth="1.5" strokeDasharray="85 1500" strokeLinecap="round" vectorEffect="non-scaling-stroke"
          variants={{ rest: { opacity: 0, strokeDashoffset: 0 }, hover: { opacity: .85, strokeDashoffset: -430 } }}
          transition={{ duration: .85, ease: "easeInOut" }}
        />
      </svg>
      {children}
    </motion.div>
  );
}

export function SignatureContourIcon({ children }: { children: ReactNode }) {
  return <motion.span className="capability-icon" variants={{ rest: { y: 0 }, hover: { y: -2 } }} transition={{ type: "spring", stiffness: 300, damping: 22 }}>{children}</motion.span>;
}
