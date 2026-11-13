"use client";

import { AnimatePresence, motion } from "motion/react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { dialog, duration, spring } from "@/lib/motion";
import { cn } from "@/lib/cn";

/** ExpenviaModal — accessible (Radix) dialog with Fluid Motion enter/exit. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const t = useTranslations("common");
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration.standard }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={description ? undefined : undefined}>
              <motion.div
                variants={dialog}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(
                  "fixed inset-x-3 bottom-3 z-50 mx-auto flex max-h-[88dvh] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface-elevated shadow-[var(--atelier-elevation-3)] sm:inset-x-4 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2",
                  { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" }[size],
                )}
              >
                <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                  <div className="min-w-0">
                    <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
                    {description ? (
                      <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
                    ) : (
                      <Dialog.Description className="sr-only">{typeof title === "string" ? title : ""}</Dialog.Description>
                    )}
                  </div>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={t("close")}>
                      <X />
                    </Button>
                  </Dialog.Close>
                </div>
                {children && <div className="overflow-y-auto px-5 py-4">{children}</div>}
                {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-surface-2/40 px-5 py-3.5">{footer}</div>}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

/** ExpenviaDrawer — side panel (end side; mirrors in RTL). */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const t = useTranslations("common");
  const rtl = useLocale() === "ur";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                initial={{ x: rtl ? "-100%" : "100%" }}
                animate={{ x: 0 }}
                exit={{ x: rtl ? "-100%" : "100%" }}
                transition={spring.panel}
                className="fixed inset-y-0 end-0 z-50 flex w-full max-w-xl flex-col border-s border-border bg-surface-elevated shadow-[var(--atelier-elevation-3)]"
              >
                <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                  <div className="min-w-0">
                    <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
                    <Dialog.Description className={description ? "mt-1 text-sm text-muted" : "sr-only"}>{description ?? ""}</Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={t("close")}>
                      <X />
                    </Button>
                  </Dialog.Close>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
                {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-surface-2/40 px-5 py-3.5">{footer}</div>}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
