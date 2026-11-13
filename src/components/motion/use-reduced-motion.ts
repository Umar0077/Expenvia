"use client";

import { useEffect, useState } from "react";

/**
 * Combines the OS preference with the user's in-app choice, applied as
 * <html data-motion="full|reduced|system">.
 *
 * Hydration-safe: returns `false` during SSR and the first client render
 * (identical markup on both sides), then resolves the real value after mount.
 * Global CSS + <MotionConfig> already neutralize motion for reduced users, so
 * this one-frame delay never produces visible animation for them.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => {
      const pref = el.dataset.motion;
      setReduced(pref === "reduced" ? true : pref === "full" ? false : mq.matches);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(el, { attributes: true, attributeFilter: ["data-motion"] });
    mq.addEventListener("change", read);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", read);
    };
  }, []);

  return reduced;
}
