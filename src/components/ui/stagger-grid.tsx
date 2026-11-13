"use client";

import { motion } from "motion/react";
import { stagger } from "@/lib/motion";

/** Staggers its MetricCard children in once on mount (fadeUp variants). */
export function StaggerGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={stagger(0.06)} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );
}
