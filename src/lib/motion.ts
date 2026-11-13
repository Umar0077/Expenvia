/**
 * Expenvia Fluid Motion — the single source of truth for animation timing.
 * Components import from here; no ad-hoc durations or springs elsewhere.
 */
import type { Transition, Variants } from "motion/react";

export const duration = {
  micro: 0.15, // 120–180ms
  standard: 0.23, // 180–280ms
  panel: 0.3, // 240–360ms
  page: 0.34, // 280–420ms
  hero: 0.7, // 500–900ms, marketing only
} as const;

export const ease = {
  out: [0.22, 1, 0.36, 1] as const, // calm deceleration
  inOut: [0.65, 0, 0.35, 1] as const,
  emphasized: [0.2, 0, 0, 1] as const,
};

export const spring = {
  /** Jelly toggle thumb — tuned from the 400/26/0.7 starting point. */
  jelly: { type: "spring", stiffness: 420, damping: 27, mass: 0.7 } satisfies Transition,
  /** Segmented selectors, tabs indicator. */
  soft: { type: "spring", stiffness: 340, damping: 32, mass: 0.8 } satisfies Transition,
  /** Panels, drawers. Critically damped — no overshoot on large surfaces. */
  panel: { type: "spring", stiffness: 300, damping: 36, mass: 1 } satisfies Transition,
  /** Magnetic CTA return. */
  magnetic: { type: "spring", stiffness: 220, damping: 18, mass: 0.5 } satisfies Transition,
} as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.standard, ease: ease.out } },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.standard, ease: ease.out } },
};

export const stagger = (step = 0.05, delay = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: step, delayChildren: delay } },
});

export const page: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.page, ease: ease.out } },
};

export const dialog: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 6 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: duration.panel, ease: ease.out } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: duration.micro, ease: ease.inOut } },
};

export const chartReveal: Variants = {
  hidden: { opacity: 0, clipPath: "inset(0 100% 0 0)" },
  visible: {
    opacity: 1,
    clipPath: "inset(0 0% 0 0)",
    transition: { duration: duration.hero, ease: ease.out },
  },
};

export const notificationItem: Variants = {
  hidden: { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0, transition: { duration: duration.standard, ease: ease.out } },
  exit: { opacity: 0, height: 0, transition: { duration: duration.micro } },
};
