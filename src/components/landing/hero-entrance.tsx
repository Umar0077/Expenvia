"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useAnimationControls } from "motion/react";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import { duration, ease } from "@/lib/motion";

/** Readable SSR content, with one small entrance after hydration. */
export function HeroEntrance({ children, className, delay = 0, fade = true }: { children: ReactNode; className?: string; delay?: number; fade?: boolean }) {
  const reduced = useReducedMotion(), controls = useAnimationControls(), played = useRef(false);
  useEffect(() => {
    if (reduced) { controls.stop(); controls.set({ opacity: 1, y: 0 }); return; }
    if (played.current) return;
    played.current = true;
    void controls.start({ opacity: fade ? [.5, 1] : 1, y: [12, 0], transition: { duration: duration.hero * .8, delay, ease: ease.out } });
  }, [controls, reduced, delay, fade]);
  return <motion.div initial={false} animate={controls} className={className}>{children}</motion.div>;
}
