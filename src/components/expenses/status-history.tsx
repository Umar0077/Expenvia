import { getLocale, getTranslations } from "next-intl/server";
import { Badge, STATUS_TONE } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

/** Shared status timeline for expenses and invoices. */
export async function StatusHistory({ items }: { items: { id: string; toStatus: string; note: string | null; createdAt: Date; actor: { fullName: string } }[] }) {
  const ts = await getTranslations("status");
  const locale = (await getLocale()) as AppLocale;
  return (
    <ol className="space-y-4 border-s-2 border-border ps-5">
      {items.map((h, i) => (
        <li key={h.id} className="relative">
          <span className={`absolute -start-[27px] top-1 size-3 rounded-full border-2 border-surface ${i === items.length - 1 ? "bg-brand" : "bg-border-strong"}`} />
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[h.toStatus]}>{ts(h.toStatus as "DRAFT")}</Badge>
            <span className="text-xs text-muted">{formatDateTime(h.createdAt, locale)}</span>
          </div>
          <p className="mt-1 text-sm text-muted">{h.actor.fullName}</p>
          {h.note && <p className="mt-1.5 rounded-[var(--radius-md)] bg-surface-2 px-3 py-2 text-sm whitespace-pre-line">{h.note}</p>}
        </li>
      ))}
    </ol>
  );
}
