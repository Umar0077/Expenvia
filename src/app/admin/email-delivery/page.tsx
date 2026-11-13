import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Mail } from "lucide-react";
import { z } from "zod";
import { db } from "@/server/db";
import { requireActor } from "@/server/auth/session";
import { Card, Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/filter-bar";
import { Pagination, pageFrom } from "@/components/ui/pagination";
import { EmailRefresh, EmailRetry } from "@/components/admin/email-controls";
import { emailCopy } from "@/server/email/templates";
import { formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";
import type { Prisma } from "@/generated/prisma/client";

const statuses = ["PENDING", "PROCESSING", "SENT", "RETRY_SCHEDULED", "FAILED", "PREVIEWED", "CANCELLED"] as const;
export default async function EmailDeliveryPage({ searchParams }: { searchParams: Promise<Record<string,string | undefined>> }) {
  await requireActor("SUPER_ADMIN");
  const sp = await searchParams, t = await getTranslations("emailDelivery"), locale = (await getLocale()) as AppLocale;
  const status = z.enum(statuses).optional().catch(undefined).parse(sp.status);
  const event = Object.hasOwn(emailCopy, sp.event ?? "") ? sp.event : undefined;
  const q = z.string().trim().max(254).catch("").parse(sp.q ?? "");
  const date = z.iso.date().optional().catch(undefined);
  const from = date.parse(sp.from), to = date.parse(sp.to), page = pageFrom(sp), selected = z.uuid().optional().catch(undefined).parse(sp.id);
  const where: Prisma.EmailOutboxWhereInput = { ...(status ? { status } : {}), ...(event ? { eventType: event } : {}), ...(q ? { recipient: { contains: q, mode: "insensitive" } } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lt: new Date(new Date(to).getTime() + 86400000) } : {}) } } : {}) };
  // Explicit allowlist: never read or serialize encrypted bodies, authTokenId or links here.
  const select = { id: true, eventType: true, recipient: true, status: true, attempts: true, maxAttempts: true, manualRetries: true, createdAt: true, lastAttemptAt: true, sentAt: true, nextAttemptAt: true, errorCategory: true, provider: true, language: true } as const;
  const [rows, total, counts, detail] = await Promise.all([
    db.emailOutbox.findMany({ where, select, orderBy: { createdAt: "desc" }, skip: (page-1)*25, take: 25 }),
    db.emailOutbox.count({ where }), db.emailOutbox.groupBy({ by: ["status"], _count: true }),
    selected ? db.emailOutbox.findUnique({ where: { id: selected }, select }) : null,
  ]);
  const count = (s: string) => counts.find(c => c.status === s)?._count ?? 0;
  const mask = (s: string) => { const [local, domain] = s.split("@"); return `${local?.[0] ?? ""}•••@${domain}`; };
  const eventLabel = (s: string) => emailCopy[s as keyof typeof emailCopy]?.[locale === "ur" ? 2 : 0] ?? s;
  const time = (d: Date | null) => d ? formatDateTime(d, locale) : "—";
  return <>
    <PageHeader title={t("title")} description={t("description")} actions={<EmailRefresh />} />
    <p className="mb-5 rounded-xl border border-border bg-surface-2 p-3 text-sm text-muted">{t("deliveryNotice")}</p>
    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      <Card className="p-4"><p className="text-xs text-muted">{t("total")}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{counts.reduce((a,c)=>a+c._count,0)}</p></Card>
      {(["SENT","PENDING","PROCESSING","RETRY_SCHEDULED","FAILED","PREVIEWED"] as const).map(s => <Card key={s} className="p-4"><p className="text-xs text-muted">{t(`statuses.${s}`)}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{count(s)}</p></Card>)}
    </div>
    <FilterBar search={{ name: "q", placeholder: t("search"), value: q }} selects={[
      { name:"status", label:t("status"), value:status ?? "", options:statuses.map(s=>({value:s,label:t(`statuses.${s}`)})) },
      { name:"event", label:t("category"), value:event ?? "", options:Object.keys(emailCopy).map(s=>({value:s,label:eventLabel(s)})) },
    ]} dates={[{name:"from",label:t("from"),value:from ?? ""},{name:"to",label:t("to"),value:to ?? ""}]} />
    {detail && <Card className="mb-5 p-5"><h2 className="font-semibold">{t("details")}</h2><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
      {[[t("id"),detail.id],[t("category"),eventLabel(detail.eventType)],[t("recipient"),mask(detail.recipient)],[t("provider"),detail.provider ?? "—"],[t("language"),detail.language],[t("error"),detail.errorCategory ? t(`errors.${detail.errorCategory}` as never) : "—"],[t("lastAttempt"),time(detail.lastAttemptAt)],[t("nextAttempt"),time(detail.nextAttemptAt)]].map(([k,v])=><div key={k}><dt className="text-muted">{k}</dt><dd className="break-all">{v}</dd></div>)}
    </dl></Card>}
    <Card className="overflow-hidden">{rows.length ? <><div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead className="bg-surface-2 text-xs text-muted"><tr>{["id","category","recipient","created","status","attempts","lastAttempt","actions"].map(k=><th key={k} className="whitespace-nowrap px-4 py-3 text-start font-medium">{t(k as never)}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map(r=><tr key={r.id}>
      <td className="px-4 py-3"><Link className="text-brand underline" href={`?${new URLSearchParams({...Object.fromEntries(Object.entries(sp).filter(([,v])=>v) as [string,string][]), id:r.id})}`}><span dir="ltr" title={r.id}>{r.id.slice(0,8)}</span></Link></td>
      <td className="px-4 py-3">{eventLabel(r.eventType)}</td><td className="px-4 py-3"><bdi>{mask(r.recipient)}</bdi></td><td className="whitespace-nowrap px-4 py-3">{time(r.createdAt)}</td>
      <td className="px-4 py-3"><Badge tone={r.status === "FAILED" ? "danger" : r.status === "SENT" ? "success" : "neutral"}>{t(`statuses.${r.status}`)}</Badge></td><td className="px-4 py-3">{r.attempts}/{r.maxAttempts}</td><td className="whitespace-nowrap px-4 py-3">{time(r.lastAttemptAt)}</td>
      <td className="px-4 py-3">{r.status === "FAILED" && r.manualRetries < 2 && !["verification","password_reset"].includes(r.eventType) ? <EmailRetry id={r.id} /> : "—"}</td>
    </tr>)}</tbody></table></div><Pagination page={page} total={total} sp={sp} pageSize={25}/></> : <EmptyState icon={Mail} title={t("empty")} />}</Card>
  </>;
}
