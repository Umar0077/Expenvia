import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, ScrollText, ShieldAlert, XCircle } from "lucide-react";
import { z } from "zod";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/filter-bar";
import { Pagination, pageFrom } from "@/components/ui/pagination";
import { ExportButton } from "@/components/admin/export-button";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AppLocale } from "@/i18n/config";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);
const SIZE = 40;

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireActor("SUPER_ADMIN");
  const sp = await searchParams;
  const action = z.string().trim().max(60).regex(/^[a-z_.]*$/).catch("").parse(sp.q ?? "");
  const actor = z.string().uuid().optional().catch(undefined).parse(sp.actor);
  const branch = z.string().uuid().optional().catch(undefined).parse(sp.branch);
  const outcome = z.enum(["SUCCESS", "FAILURE", "DENIED"]).optional().catch(undefined).parse(sp.outcome);
  const from = date.parse(sp.from);
  const to = date.parse(sp.to);
  const selected = z.string().uuid().safeParse(sp.id).data;
  const page = pageFrom(sp);
  const t = await getTranslations("audit");
  const tr = await getTranslations("roles");
  const tn = await getTranslations("nav");
  const locale = (await getLocale()) as AppLocale;

  const where = {
    ...(action ? { action: { startsWith: action } } : {}),
    ...(actor ? { actorId: actor } : {}),
    ...(branch ? { branchId: branch } : {}),
    ...(outcome ? { outcome } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}), ...(to ? { lt: new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400000) } : {}) } } : {}),
  };
  const [rows, total, actors, branches, detail] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * SIZE, take: SIZE, include: { actor: { select: { fullName: true, email: true } }, branch: { select: { name: true } } } }),
    db.auditLog.count({ where }),
    db.user.findMany({ where: { role: { not: null } }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    db.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    selected ? db.auditLog.findUnique({ where: { id: selected }, include: { actor: { select: { fullName: true, email: true } }, branch: { select: { name: true } } } }) : null,
  ]);
  const label = (a: string) => (t.has(`actions.${a.replace(/\./g, "_")}` as never) ? t(`actions.${a.replace(/\./g, "_")}` as never) : a);
  const OutcomeIcon = { SUCCESS: CheckCircle2, FAILURE: XCircle, DENIED: ShieldAlert } as const;
  const tone = { SUCCESS: "text-success", FAILURE: "text-danger", DENIED: "text-warning" } as const;
  const qs = new URLSearchParams(Object.entries({ action: action || undefined, actor, branch, from, to }).filter(([, v]) => v) as [string, string][]).toString();
  const linkFor = (id: string) => `?${new URLSearchParams([...Object.entries(sp).filter(([k, v]) => v && k !== "id") as [string, string][], ["id", id]]).toString()}`;

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={<ExportButton report="audit" query={qs} />} />
      <FilterBar
        search={{ name: "q", placeholder: t("searchPlaceholder"), value: action }}
        selects={[
          { name: "outcome", label: t("outcomeLabel"), value: outcome ?? "", options: (["SUCCESS", "FAILURE", "DENIED"] as const).map((o) => ({ value: o, label: t(`outcome.${o}`) })) },
          { name: "actor", label: t("actor"), value: actor ?? "", options: actors.map((a) => ({ value: a.id, label: a.fullName })) },
          { name: "branch", label: tn("branches"), value: branch ?? "", options: branches.map((b) => ({ value: b.id, label: b.name })) },
        ]}
        dates={[{ name: "from", label: "↦", value: from ?? "" }, { name: "to", label: "↤", value: to ?? "" }]}
      />
      <div className={selected ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]" : ""}>
        <Card className="h-fit overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState icon={ScrollText} title={t("empty")} />
          ) : (
            <>
              <ol className="divide-y divide-border">
                {rows.map((a) => {
                  const Icon = OutcomeIcon[a.outcome];
                  return (
                    <li key={a.id}>
                      <Link href={linkFor(a.id)} scroll={false} className={cn("flex items-start gap-3 px-5 py-3 transition-colors hover:bg-surface-2/60", a.id === selected && "bg-brand-soft/50")}>
                        <Icon className={cn("mt-0.5 size-4 shrink-0", tone[a.outcome])} aria-label={t(`outcome.${a.outcome}`)} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{label(a.action)} <span className="ltr-data ms-1 text-2xs font-normal text-muted">{a.action}</span></p>
                          <p className="truncate text-xs text-muted">
                            {a.actor?.fullName ?? t("system")}{a.actorRole ? ` · ${tr(a.actorRole)}` : ""}{a.branch ? ` · ${a.branch.name}` : ""}
                          </p>
                        </div>
                        <time className="shrink-0 text-xs text-muted" dateTime={a.createdAt.toISOString()}>{formatDateTime(a.createdAt, locale)}</time>
                      </Link>
                    </li>
                  );
                })}
              </ol>
              <Pagination page={page} total={total} sp={sp} pageSize={SIZE} />
            </>
          )}
        </Card>
        {detail && (
          <Card className="h-fit xl:sticky xl:top-[calc(var(--header-h)+24px)]">
            <div className="border-b border-border p-5">
              <p className="text-xs text-muted">{t("details")}</p>
              <h2 className="mt-1 text-base font-semibold">{label(detail.action)}</h2>
              <Badge tone={detail.outcome === "SUCCESS" ? "success" : detail.outcome === "DENIED" ? "warning" : "danger"} className="mt-2">{t(`outcome.${detail.outcome}`)}</Badge>
            </div>
            <dl className="grid gap-3 p-5 text-sm">
              <Row k={t("time")} v={<span className="ltr-data">{detail.createdAt.toISOString()}</span>} />
              <Row k={t("actor")} v={detail.actor ? <>{detail.actor.fullName}<span className="ltr-data block text-xs text-muted">{detail.actor.email}</span></> : t("system")} />
              <Row k={t("entity")} v={detail.entityType && <span className="ltr-data">{detail.entityType} · {detail.entityId}</span>} />
              <Row k={t("branch")} v={detail.branch?.name} />
              <Row k={t("request")} v={detail.requestId && <span className="ltr-data break-all">{detail.requestId}</span>} />
              <Row k={t("ip")} v={detail.ipAddress && <span className="ltr-data">{detail.ipAddress}</span>} />
              {detail.summary && (
                <div>
                  <dt className="text-xs text-muted">{t("summary")}</dt>
                  <dd><pre dir="ltr" className="mt-1 max-h-72 overflow-auto rounded-[var(--radius-md)] bg-surface-2 p-3 text-xs leading-relaxed">{JSON.stringify(detail.summary, null, 2)}</pre></dd>
                </div>
              )}
            </dl>
          </Card>
        )}
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  if (!v) return null;
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-0 break-words font-medium">{v}</dd>
    </div>
  );
}
