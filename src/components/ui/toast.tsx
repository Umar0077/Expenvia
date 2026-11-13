"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { notificationItem } from "@/lib/motion";
import { cn } from "@/lib/cn";

type Tone = "success" | "error";
interface Toast {
  id: number;
  tone: Tone;
  message: string;
}
const Ctx = createContext<(message: string, tone?: Tone) => void>(() => {});

/** ExpenviaToast — announced politely to screen readers. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Tone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 end-4 z-[80] flex w-[min(92vw,360px)] flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              variants={notificationItem}
              initial="hidden"
              animate="visible"
              exit="exit"
              role={t.tone === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex items-start gap-2.5 rounded-[var(--radius-lg)] border bg-surface-elevated px-4 py-3 text-sm shadow-[var(--shadow-raised)]",
                t.tone === "success" ? "border-success/30" : "border-danger/30",
              )}
            >
              {t.tone === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
