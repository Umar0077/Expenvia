"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface SelectDef {
  name: string;
  label: string;
  value: string;
  /** Value that counts as "not filtered" (e.g. the default period). */
  defaultValue?: string;
  options: { value: string; label: string }[];
}
interface DateDef {
  name: string;
  label: string;
  value: string;
}

/**
 * URL-driven filters: every change updates the query string so filtering,
 * sorting and pagination happen on the server (shareable, back-button safe).
 */
export function FilterBar({ search, selects = [], dates = [], className }: { search?: { name: string; placeholder: string; value: string }; selects?: SelectDef[]; dates?: DateDef[]; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useTranslations("app.table");
  const [pending, start] = useTransition();
  const [q, setQ] = useState(search?.value ?? "");

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    next.delete("id");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    if (!search || q === (search.value ?? "")) return;
    const id = setTimeout(() => update({ [search.name]: q.trim() }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = (search?.value ? 1 : 0) + selects.filter((s) => s.value && s.value !== s.defaultValue).length + dates.filter((d) => d.value).length;

  return (
    <div className={cn("mb-5 flex flex-wrap items-end gap-2.5", className)} aria-busy={pending}>
      {search && (
        <label className="relative w-full min-w-0 sm:w-auto sm:min-w-[240px] sm:flex-1 sm:max-w-sm">
          <span className="sr-only">{search.placeholder}</span>
          {pending ? <Loader2 className="absolute start-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" /> : <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />}
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={search.placeholder}
            className="h-10 w-full rounded-full border border-border bg-surface ps-9 pe-4 text-sm shadow-[var(--shadow-card)] placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/15"
          />
        </label>
      )}
      {selects.map((s) => (
        <label key={s.name} className="relative min-w-0 max-w-full basis-40 grow sm:basis-auto sm:grow-0">
          <span className="sr-only">{s.label}</span>
          <select
            value={s.value}
            onChange={(e) => update({ [s.name]: e.target.value })}
            className={cn(
              "h-10 w-full appearance-none truncate rounded-full border bg-surface ps-4 pe-9 text-sm sm:w-auto sm:max-w-[280px] shadow-[var(--shadow-card)] focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/15",
              s.value ? "border-brand/50 text-text" : "border-border text-muted",
            )}
          >
            <option value="">
              {s.label}: {t("all")}
            </option>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted">
            <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </label>
      ))}
      {dates.map((d) => (
        <label key={d.name} className="flex flex-col gap-1">
          <span className="ps-1 text-2xs font-medium text-muted">{d.label}</span>
          <input
            type="date"
            value={d.value}
            onChange={(e) => update({ [d.name]: e.target.value })}
            className="h-10 rounded-full border border-border bg-surface px-4 text-sm shadow-[var(--shadow-card)] focus:border-brand focus:outline-none"
          />
        </label>
      ))}
      {active > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-10"
          onClick={() => {
            setQ("");
            update(Object.fromEntries([...(search ? [search.name] : []), ...selects.map((s) => s.name), ...dates.map((d) => d.name)].map((k) => [k, ""])));
          }}
        >
          <X /> {t("clearFilters")}
        </Button>
      )}
    </div>
  );
}
