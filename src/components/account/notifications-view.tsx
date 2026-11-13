import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Bell, ChevronRight } from "lucide-react";
import { z } from "zod";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { Pagination, PAGE_SIZE, pageFrom } from "@/components/ui/pagination";
import { MarkAllReadButton, MarkReadButton } from "@/components/account/notification-buttons";
import { db } from "@/server/db";
import type { Actor } from "@/server/auth/session";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AppLocale } from "@/i18n/config";

/** Full notifications page — rows are always filtered to the current user. */
export async function NotificationsView({ actor, sp }: { actor: Actor; sp: Record<string, string | undefined> }) {
  const t = await getTranslations("app.notifications");
  const tp = await getTranslations("notifyPage");
  const locale = (await getLocale()) as AppLocale;
  const unreadOnly = z.enum(["unread"]).optional().catch(undefined).parse(sp.filter) === "unread";
  const page = pageFrom(sp);
  const where = { userId: actor.userId, ...(unreadOnly ? { readAt: null } : {}) };
  const [rows, total, unread] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId: actor.userId, readAt: null } }),
  ]);
  const text = (type: string, params: unknown) => {
    const key = `types.${type}` as never;
    return t.has(key) ? t(key, (params ?? {}) as never) : type;
  };

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={unread > 0 ? <MarkAllReadButton label={t("markAllRead")} /> : undefined} />
      <div className="mb-4 flex gap-1">
        {[{ k: "", l: tp("all") }, { k: "unread", l: `${tp("unread")} (${unread})` }].map((f) => (
          <Link key={f.k} href={f.k ? `?filter=${f.k}` : "?"} aria-current={(f.k === "unread") === unreadOnly ? "page" : undefined}
            className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium", (f.k === "unread") === unreadOnly ? "bg-brand text-brand-fg" : "border border-border bg-surface text-muted")}>
            {f.l}
          </Link>
        ))}
      </div>
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Bell} title={t("empty")} body={t("emptyBody")} />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {rows.map((n) => (
                <li key={n.id} className={cn("flex items-start gap-3 px-5 py-4", !n.readAt && "bg-brand-soft/30")}>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-copper")} aria-label={n.readAt ? undefined : t("unread")} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", !n.readAt && "font-medium")}>{text(n.type, n.params)}</p>
                    <p className="mt-0.5 text-xs text-muted">{formatDateTime(n.createdAt, locale)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!n.readAt && <MarkReadButton id={n.id} label={t("markRead")} />}
                    {n.href && (
                      <Link href={n.href} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-brand hover:bg-brand-soft">
                        {t("viewItem")} <ChevronRight className="size-3.5 rtl:-scale-x-100" />
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={page} total={total} sp={sp} />
          </>
        )}
      </Card>
    </>
  );
}
