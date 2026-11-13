import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Briefcase, Inbox, Store } from "lucide-react";
import { z } from "zod";
import { Badge, Card, EmptyState, PageHeader, STATUS_TONE } from "@/components/ui/primitives";
import { RegistrationActions } from "@/components/admin/registration-actions";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { cn } from "@/lib/cn";

const STATUSES = ["PENDING", "INFO_REQUESTED", "APPROVED", "REJECTED"] as const;

export default async function RegistrationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireActor("SUPER_ADMIN");
  const sp = await searchParams;
  const status = z.enum(STATUSES).catch("PENDING").parse(sp.status);
  const selectedId = z.string().uuid().safeParse(sp.id).data;
  const t = await getTranslations("registrations");
  const tr = await getTranslations("roles");
  const f = await getFormatter();

  const [counts, rows] = await Promise.all([
    db.registrationRequest.groupBy({ by: ["status"], _count: true, where: { user: { status: { not: "PENDING_VERIFICATION" } } } }),
    db.registrationRequest.findMany({
      // Unverified applicants are hidden until they confirm their email.
      where: { status, user: { status: { not: "PENDING_VERIFICATION" } } },
      orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
      take: 100,
      include: {
        user: { select: { fullName: true, email: true, phone: true, emailVerifiedAt: true, status: true } },
        reviewedBy: { select: { fullName: true } },
      },
    }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const selected = rows.find((r) => r.id === selectedId) ?? (rows.length > 0 && !selectedId ? rows[0] : undefined);
  const branches = await db.branch.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true, city: true } });

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      <nav aria-label={t("title")} className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1 sm:w-fit">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              s === status ? "bg-brand text-brand-fg" : "text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            {t(`tabs.${s}`)}
            <span className={cn("tabular rounded-full px-1.5 text-2xs", s === status ? "bg-white/20" : "bg-surface-2")}>{countOf(s)}</span>
          </Link>
        ))}
      </nav>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState icon={Inbox} title={t("empty")} body={t("emptyBody")} />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => {
                const active = r.id === selected?.id;
                const Icon = r.requestedType === "VENDOR" ? Store : Briefcase;
                return (
                  <li key={r.id}>
                    <Link
                      href={`?status=${status}&id=${r.id}`}
                      scroll={false}
                      aria-current={active ? "true" : undefined}
                      className={cn("flex items-center gap-4 px-5 py-4 transition-colors", active ? "bg-brand-soft/50" : "hover:bg-surface-2/60")}
                    >
                      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", r.requestedType === "VENDOR" ? "bg-copper-soft text-copper" : "bg-brand-soft text-brand")}>
                        <Icon className="size-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{r.businessName ?? r.user.fullName}</span>
                        <span className="ltr-data block truncate text-xs text-muted">{r.user.email}</span>
                      </span>
                      <span className="hidden text-end sm:block">
                        <Badge tone={r.requestedType === "VENDOR" ? "copper" : "brand"} dot={false}>
                          {tr(r.requestedType)}
                        </Badge>
                        <span className="mt-1 block text-xs text-muted">{f.relativeTime(r.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="h-fit xl:sticky xl:top-[calc(var(--header-h)+24px)]">
          {!selected ? (
            <EmptyState icon={Inbox} title={t("selectPrompt")} />
          ) : (
            <div>
              <div className="border-b border-border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted">{t("details")}</p>
                    <h2 className="mt-1 text-lg font-semibold">{selected.user.fullName}</h2>
                  </div>
                  <Badge tone={STATUS_TONE[selected.status]}>{t(`tabs.${selected.status}`)}</Badge>
                </div>
              </div>
              <dl className="grid gap-4 p-5 text-sm">
                <Row label={t("requested")} value={tr(selected.requestedType)} />
                <Row label={t("contact")} value={<><span className="ltr-data block">{selected.user.email}</span>{selected.user.phone && <span className="ltr-data block text-muted">{selected.user.phone}</span>}</>} />
                <Row label={t("emailStatus")} value={selected.user.emailVerifiedAt ? <Badge tone="success">{t("verified")}</Badge> : <Badge>{t("unverified")}</Badge>} />
                <Row label={t("submitted")} value={f.dateTime(selected.createdAt, { dateStyle: "medium", timeStyle: "short" })} />
                {selected.requestedType === "VENDOR" && (
                  <>
                    <Row label={t("business")} value={selected.businessName} />
                    <Row label={t("category")} value={selected.businessCategory} />
                    <Row label={t("taxId")} value={selected.taxIdentifier && <span className="ltr-data">{selected.taxIdentifier}</span>} />
                    <Row label={t("address")} value={selected.businessAddress} />
                  </>
                )}
                {selected.applicantNote && <Row label={t("note")} value={<span className="whitespace-pre-line">{selected.applicantNote}</span>} />}
                {selected.reviewedBy && selected.reviewedAt && (
                  <p className="text-xs text-muted">{t("reviewedBy", { name: selected.reviewedBy.fullName, date: f.dateTime(selected.reviewedAt, { dateStyle: "medium" }) })}</p>
                )}
                {selected.reviewNote && <Row label={t("internalNote")} value={<span className="whitespace-pre-line">{selected.reviewNote}</span>} />}
              </dl>
              {(selected.status === "PENDING" || selected.status === "INFO_REQUESTED") && (
                <div className="border-t border-border p-5">
                  <RegistrationActions
                    id={selected.id}
                    name={selected.businessName ?? selected.user.fullName}
                    type={selected.requestedType}
                    branches={branches}
                  />
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value}</dd>
    </div>
  );
}
