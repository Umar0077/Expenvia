"use client";

import { motion } from "motion/react";
import { page } from "@/lib/motion";

/** Animate the route template, without keying/remounting Next's layout router. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return <motion.div variants={page} initial="hidden" animate="visible">{children}</motion.div>;
}
