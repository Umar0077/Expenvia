import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export interface AuditItem {
  id: string;
  action: string;
  outcome: string;
  createdAt: Date;
  actor: { fullName: string } | null;
  actorRole: string | null;
}

/** Readable audit timeline (shared by entity pages and the audit viewer). */
export async function AuditTimeline({ items }: { items: AuditItem[] }) {
  const t = await getTranslations("audit");
  const tr = await getTranslations("roles");
  const locale = (await getLocale()) as AppLocale;
  const label = (a: string) => (t.has(`actions.${a.replace(/\./g, "_")}` as never) ? t(`actions.${a.replace(/\./g, "_")}` as never) : a);
  return (
    <ol className="space-y-3.5">
      {items.map((a) => {
        const Icon = a.outcome === "SUCCESS" ? CheckCircle2 : a.outcome === "DENIED" ? ShieldAlert : XCircle;
        const tone = a.outcome === "SUCCESS" ? "text-success" : a.outcome === "DENIED" ? "text-warning" : "text-danger";
        return (
          <li key={a.id} className="flex gap-3">
            <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} aria-label={t(`outcome.${a.outcome}` as never)} />
            <div className="min-w-0">
              <p className="text-sm font-medium">{label(a.action)}</p>
              <p className="text-xs text-muted">
                {a.actor?.fullName ?? t("system")}{a.actorRole ? ` · ${tr(a.actorRole as "USER")}` : ""} · {formatDateTime(a.createdAt, locale)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
