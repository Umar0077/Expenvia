import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight, Building2, CheckCircle2, Clock3, Plus, Receipt, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { MetricCard } from "@/components/ui/metric-card";
import { StaggerGrid } from "@/components/ui/stagger-grid";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { requireActor } from "@/server/auth/session";
import { loadSubject } from "@/server/authz/subject";
import { db } from "@/server/db";
import { REPORTING_CURRENCY } from "@/server/services/reporting-service";

export default async function UserDashboard() {
  const actor = await requireActor("USER");
  const subject = await loadSubject(actor);
  const t = await getTranslations("userDash");
  const te = await getTranslations("expenses");

  // Every aggregate below is filtered to ownerId = current user. No branch or company totals.
  const own = { ownerId: actor.userId, currency: REPORTING_CURRENCY };
  const [submitted, approved, pending, rejected, drafts, recent, branch] = await Promise.all([
    db.expense.aggregate({ where: { ...own, status: { not: "DRAFT" } }, _sum: { amount: true }, _count: true }),
    db.expense.aggregate({ where: { ...own, status: "APPROVED" }, _sum: { amount: true }, _count: true }),
    db.expense.aggregate({ where: { ...own, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } }, _sum: { amount: true }, _count: true }),
    db.expense.aggregate({ where: { ...own, status: "REJECTED" }, _sum: { amount: true }, _count: true }),
    db.expense.count({ where: { ownerId: actor.userId, status: { in: ["DRAFT", "REVISION_REQUESTED"] } } }),
    db.expense.findMany({
      where: { ownerId: actor.userId },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { category: { select: { nameEn: true, nameUr: true } }, _count: { select: { attachments: true } } },
    }),
    subject.activeBranchId ? db.branch.findUnique({ where: { id: subject.activeBranchId }, select: { name: true, code: true } }) : null,
  ]);
  const sum = (a: { _sum: { amount: { toString(): string } | null } }) => a._sum.amount?.toString() ?? "0";
  const first = actor.fullName.split(" ")[0];

  return (
    <>
      <PageHeader
        title={t("greeting", { name: first ?? actor.fullName })}
        description={t("subtitle")}
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="size-3.5" /> {t("branchLabel")}: {branch ? <>{branch.name} <span className="ltr-data">({branch.code})</span></> : t("noBranch")}
          </span>
        }
        actions={
          <Button asChild>
            <Link href="/user/expenses/new"><Plus /> {te("new")}</Link>
          </Button>
        }
      />
      <StaggerGrid className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t("totalSubmitted")} value={sum(submitted)} currency={REPORTING_CURRENCY} icon={<Receipt />} footnote={t("countLabel", { count: submitted._count })} />
        <MetricCard label={t("approved")} value={sum(approved)} currency={REPORTING_CURRENCY} icon={<CheckCircle2 />} tone="success" footnote={t("countLabel", { count: approved._count })} />
        <MetricCard label={t("pending")} value={sum(pending)} currency={REPORTING_CURRENCY} icon={<Clock3 />} tone="warning" footnote={t("countLabel", { count: pending._count })} />
        <MetricCard label={t("rejected")} value={sum(rejected)} currency={REPORTING_CURRENCY} icon={<XCircle />} tone="danger" footnote={t("drafts", { count: drafts })} />
      </StaggerGrid>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title={t("recent")}
          description={t("onlyYours")}
          action={
            <Link href="/user/expenses" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              {t("viewAll")} <ArrowUpRight className="size-3.5 rtl:-scale-x-100" />
            </Link>
          }
        />
        {recent.length === 0 ? (
          <EmptyState icon={Receipt} title={te("empty")} body={te("emptyBody")} />
        ) : (
          <ExpenseTable rows={recent} href={(id) => `/user/expenses/${id}`} />
        )}
      </Card>
    </>
  );
}
