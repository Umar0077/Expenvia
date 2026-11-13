"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Dialog } from "radix-ui";
import { useTranslations } from "next-intl";
import { Building2, FileText, Loader2, Package, Receipt, Search, Store, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dialog } from "@/lib/motion";
import { cn } from "@/lib/cn";
import type { Role } from "@/generated/prisma/enums";
import { searchAction, type SearchHit } from "@/server/actions/search";

const ICONS = { branch: Building2, employee: User, vendor: Store, expense: Receipt, invoice: FileText, supply: Package };

/** ExpenviaSearch — ⌘K / Ctrl+K palette. Results are scoped server-side by role. */
export function GlobalSearch({ role }: { role: Role }) {
  const t = useTranslations("app.search");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const id = ++seq.current;
    const timer = setTimeout(() => {
      start(async () => {
        const res = await searchAction(q);
        if (id === seq.current) {
          setHits(res);
          setActive(0);
        }
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [q]);

  const go = (h: SearchHit) => {
    setOpen(false);
    setQ("");
    router.push(h.href);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="hidden h-9 w-64 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm text-muted transition-colors hover:border-border-strong md:flex"
        >
          <Search className="size-4" />
          <span className="flex-1 truncate text-start">{t(`placeholder.${role}`)}</span>
          <kbd className="rounded border border-border bg-surface-2 px-1.5 font-sans text-[10px]" dir="ltr">Ctrl K</kbd>
        </button>
      </Dialog.Trigger>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("open")}>
          <Search />
        </Button>
      </Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                variants={dialog}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed inset-x-3 top-[12vh] z-50 mx-auto max-w-xl overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface-elevated shadow-[var(--shadow-overlay)]"
              >
                <Dialog.Title className="sr-only">{t("open")}</Dialog.Title>
                <div className="flex items-center gap-3 border-b border-border px-4">
                  {pending ? <Loader2 className="size-4 animate-spin text-muted" /> : <Search className="size-4 text-muted" />}
                  <input
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActive((a) => Math.min(a + 1, hits.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActive((a) => Math.max(a - 1, 0));
                      } else if (e.key === "Enter" && hits[active]) go(hits[active]);
                    }}
                    placeholder={t(`placeholder.${role}`)}
                    aria-label={t("open")}
                    role="combobox"
                    aria-expanded={hits.length > 0}
                    aria-controls="search-results"
                    className="h-14 flex-1 bg-transparent text-body outline-none placeholder:text-muted"
                  />
                </div>
                <ul id="search-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
                  {q.trim().length >= 2 && !pending && hits.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">{t("empty")}</li>}
                  {q.trim().length < 2 && <li className="px-3 py-8 text-center text-sm text-muted">{t("hint")}</li>}
                  {hits.map((h, i) => {
                    const Icon = ICONS[h.kind];
                    return (
                      <li key={`${h.kind}-${h.id}`} role="option" aria-selected={i === active}>
                        <button
                          type="button"
                          onMouseEnter={() => setActive(i)}
                          onClick={() => go(h)}
                          className={cn("flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-start", i === active && "bg-surface-2")}
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-brand-soft text-brand">
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{h.title}</span>
                            {h.subtitle && <span className="ltr-data block truncate text-xs text-muted">{h.subtitle}</span>}
                          </span>
                          <span className="text-2xs text-muted">{t(`kind.${h.kind}`)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
