import { getLocale, getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { z } from "zod";
import { Badge, Card, EmptyState, PageHeader, STATUS_TONE, Table, Td, Th, Tr } from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/filter-bar";
import { Pagination, PAGE_SIZE, pageFrom } from "@/components/ui/pagination";
import { EmployeeManager } from "@/components/admin/employee-manager";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { formatDate, formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireActor("SUPER_ADMIN");
  const sp = await searchParams;
  const q = z.string().trim().max(80).catch("").parse(sp.q ?? "");
  const branch = z.string().uuid().optional().catch(undefined).parse(sp.branch);
  const status = z.enum(["ACTIVE", "SUSPENDED"]).optional().catch(undefined).parse(sp.status);
  const page = pageFrom(sp);
  const t = await getTranslations("users");
  const ts = await getTranslations("status");
  const tn = await getTranslations("nav");
  const locale = (await getLocale()) as AppLocale;

  const ci = { contains: q, mode: "insensitive" as const };
  const where = {
    role: "USER" as const,
    ...(status ? { status } : { status: { in: ["ACTIVE" as const, "SUSPENDED" as const] } }),
    ...(q ? { OR: [{ fullName: ci }, { email: ci }] } : {}),
    ...(branch ? { branchAssignments: { some: { branchId: branch, endedAt: null } } } : {}),
  };
  const [rows, total, branches] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        _count: { select: { expenses: true } },
        branchAssignments: {
          orderBy: { startedAt: "desc" },
          select: { id: true, startedAt: true, endedAt: true, branch: { select: { id: true, name: true, code: true } }, assignedBy: { select: { fullName: true } } },
        },
      },
    }),
    db.user.count({ where }),
    db.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true, status: true } }),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <FilterBar
        search={{ name: "q", placeholder: t("searchPlaceholder"), value: q }}
        selects={[
          { name: "branch", label: tn("branches"), value: branch ?? "", options: branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })) },
          { name: "status", label: t("status"), value: status ?? "", options: [{ value: "ACTIVE", label: ts("ACTIVE") }, { value: "SUSPENDED", label: ts("SUSPENDED") }] },
        ]}
      />
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Users} title={t("empty")} body={t("emptyBody")} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>{t("name")}</Th>
                  <Th>{t("branch")}</Th>
                  <Th>{t("status")}</Th>
                  <Th className="hidden md:table-cell">{tn("expenses")}</Th>
                  <Th className="text-end">{t("manage")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const current = u.branchAssignments.find((a) => !a.endedAt);
                  return (
                    <Tr key={u.id}>
                      <Td>
                        <p className="font-medium">{u.fullName}</p>
                        <p className="ltr-data text-xs text-muted">{u.email}</p>
                      </Td>
                      <Td>{current ? <span>{current.branch.name} <span className="ltr-data text-xs text-muted">{current.branch.code}</span></span> : <Badge tone="warning">{t("unassigned")}</Badge>}</Td>
                      <Td><Badge tone={STATUS_TONE[u.status]}>{ts(u.status as "ACTIVE")}</Badge></Td>
                      <Td className="hidden text-muted md:table-cell">{t("expenseCount", { count: u._count.expenses })}</Td>
                      <Td className="text-end">
                        <EmployeeManager
                          user={{ id: u.id, fullName: u.fullName, email: u.email, status: u.status, currentBranchId: current?.branch.id ?? null }}
                          branches={branches.filter((b) => b.status === "ACTIVE")}
                          history={u.branchAssignments.map((a) => ({
                            id: a.id,
                            branch: `${a.branch.name} (${a.branch.code})`,
                            from: formatDate(a.startedAt, locale),
                            to: a.endedAt ? formatDate(a.endedAt, locale) : null,
                            by: a.assignedBy.fullName,
                          }))}
                          joined={formatDateTime(u.createdAt, locale)}
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination page={page} total={total} sp={sp} />
          </>
        )}
      </Card>
    </>
  );
}
