import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FileText, Plus } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/filter-bar";
import { Pagination, PAGE_SIZE, pageFrom } from "@/components/ui/pagination";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { requireActor } from "@/server/auth/session";
import { loadSubject } from "@/server/authz/subject";
import { db } from "@/server/db";

const STATUSES = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REVISION_REQUESTED", "PARTIALLY_PAID", "PAID"] as const;

export default async function VendorInvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor("VENDOR");
  const subject = await loadSubject(actor);
  const sp = await searchParams;
  const q = z.string().trim().max(80).catch("").parse(sp.q ?? "");
  const status = z.enum(STATUSES).optional().catch(undefined).parse(sp.status);
  const page = pageFrom(sp);
  const t = await getTranslations("invoices");
  const ts = await getTranslations("status");

  // vendorId comes from the session, never from the request.
  const where = { vendorId: subject.vendorId ?? "00000000-0000-0000-0000-000000000000", ...(status ? { status } : {}), ...(q ? { number: { contains: q, mode: "insensitive" as const } } : {}) };
  const [rows, total] = await Promise.all([
    db.invoice.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { branch: { select: { name: true, code: true } } } }),
    db.invoice.count({ where }),
  ]);
  const newBtn = (subject.vendorBranchIds?.length ?? 0) > 0 && (
    <Button asChild><Link href="/vendor/invoices/new"><Plus /> {t("new")}</Link></Button>
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("vendorDescription")} actions={newBtn} />
      <FilterBar search={{ name: "q", placeholder: t("searchPlaceholder"), value: q }} selects={[{ name: "status", label: t("status"), value: status ?? "", options: STATUSES.map((s) => ({ value: s, label: ts(s) })) }]} />
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={FileText} title={t("empty")} body={(subject.vendorBranchIds?.length ?? 0) > 0 ? t("emptyBody") : t("noBranches")} action={newBtn || undefined} />
        ) : (
          <>
            <InvoiceTable rows={rows} href={(id) => `/vendor/invoices/${id}`} />
            <Pagination page={page} total={total} sp={sp} />
          </>
        )}
      </Card>
    </>
  );
}
