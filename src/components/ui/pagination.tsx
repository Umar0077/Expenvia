import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export const PAGE_SIZE = 20;

export function pageFrom(sp: Record<string, string | undefined>): number {
  const n = Number.parseInt(sp.page ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

/** ExpenviaPagination — server-rendered links preserving current filters. */
export async function Pagination({ page, total, sp, pageSize = PAGE_SIZE }: { page: number; total: number; sp: Record<string, string | undefined>; pageSize?: number }) {
  const t = await getTranslations("app.pagination");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page" && k !== "id") as [string, string][]);
    if (p > 1) q.set("page", String(p));
    return `?${q.toString()}`;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const linkCls = "inline-flex h-9 items-center gap-1 rounded-full border border-border bg-surface px-3 text-sm font-medium";
  return (
    <nav aria-label={t("label")} className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="tabular text-sm text-muted">{t("summary", { from, to, total })}</p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={cn(linkCls, "hover:border-border-strong")} scroll={false}>
            <ChevronLeft className="size-4 rtl:-scale-x-100" /> {t("previous")}
          </Link>
        ) : (
          <span className={cn(linkCls, "opacity-40")} aria-disabled>
            <ChevronLeft className="size-4 rtl:-scale-x-100" /> {t("previous")}
          </span>
        )}
        {page < pages ? (
          <Link href={href(page + 1)} className={cn(linkCls, "hover:border-border-strong")} scroll={false}>
            {t("next")} <ChevronRight className="size-4 rtl:-scale-x-100" />
          </Link>
        ) : (
          <span className={cn(linkCls, "opacity-40")} aria-disabled>
            {t("next")} <ChevronRight className="size-4 rtl:-scale-x-100" />
          </span>
        )}
      </div>
    </nav>
  );
}
