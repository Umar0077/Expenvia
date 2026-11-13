"use client";

import { useRef } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/cn";
import { duration, ease, spring, stagger, fadeUp } from "@/lib/motion";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";

/** Reveals children once when scrolled into view. Content is fully visible without JS/motion. */
export function Reveal({ children, className, delay = 0, ...rest }: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: duration.hero * 0.8, ease: ease.out, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerGroup({ children, className, step = 0.07 }: { children: React.ReactNode; className?: string; step?: number }) {
  return (
    <motion.div
      className={className}
      variants={stagger(step)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}

/**
 * Magnetic wrapper for primary CTAs. Uses motion values (no React state) so
 * pointer movement never triggers re-renders. Disabled on touch & reduced motion.
 */
export function Magnetic({ children, strength = 0.22, className }: { children: React.ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const x = useSpring(useMotionValue(0), spring.magnetic);
  const y = useSpring(useMotionValue(0), spring.magnetic);

  const onMove = (e: React.PointerEvent) => {
    if (reduced || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    // capped to ±8px so click targets never drift away from the pointer
    x.set(Math.max(-8, Math.min(8, (e.clientX - (r.left + r.width / 2)) * strength)));
    y.set(Math.max(-6, Math.min(6, (e.clientY - (r.top + r.height / 2)) * strength)));
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div ref={ref} style={{ x, y }} onPointerMove={onMove} onPointerLeave={reset} className={cn("inline-block", className)}>
      {children}
    </motion.div>
  );
}

/** Subtle pointer tilt for showcase cards. */
export function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const rx = useSpring(0, spring.soft);
  const ry = useSpring(0, spring.soft);
  return (
    <motion.div
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      whileHover={reduced ? undefined : { y: -4 }}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 5);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 5);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 40, mass: 0.4 });
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-0.5 bg-gradient-to-r from-brand to-copper rtl:origin-right ltr:origin-left"
      style={{ scaleX }}
    />
  );
}

/** Gentle parallax for decorative layers. */
export function Parallax({ children, className, offset = 40 }: { children: React.ReactNode; className?: string; offset?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [offset, -offset]);
  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}
