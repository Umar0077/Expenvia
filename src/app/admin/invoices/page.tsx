import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { z } from "zod";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/filter-bar";
import { Pagination, PAGE_SIZE, pageFrom } from "@/components/ui/pagination";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { ExportButton } from "@/components/admin/export-button";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";

const STATUSES = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REVISION_REQUESTED", "PARTIALLY_PAID", "PAID"] as const;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);

export default async function AdminInvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireActor("SUPER_ADMIN");
  const sp = await searchParams;
  const q = z.string().trim().max(80).catch("").parse(sp.q ?? "");
  const status = z.enum(STATUSES).optional().catch(undefined).parse(sp.status);
  const branch = z.string().uuid().optional().catch(undefined).parse(sp.branch);
  const vendor = z.string().uuid().optional().catch(undefined).parse(sp.vendor);
  const pay = z.enum(["outstanding", "paid"]).optional().catch(undefined).parse(sp.pay);
  const from = date.parse(sp.from);
  const to = date.parse(sp.to);
  const page = pageFrom(sp);
  const t = await getTranslations("invoices");
  const ts = await getTranslations("status");
  const tn = await getTranslations("nav");

  const ci = { contains: q, mode: "insensitive" as const };
  // Vendor drafts are private to the vendor until submitted.
  const statusFilter = pay === "outstanding" ? { in: ["APPROVED" as const, "PARTIALLY_PAID" as const] } : pay === "paid" ? ("PAID" as const) : (status ?? { not: "DRAFT" as const });
  const where = {
    status: statusFilter,
    ...(branch ? { branchId: branch } : {}),
    ...(vendor ? { vendorId: vendor } : {}),
    ...(from || to ? { invoiceDate: { ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}), ...(to ? { lte: new Date(`${to}T00:00:00Z`) } : {}) } } : {}),
    ...(q ? { OR: [{ number: ci }, { vendor: { businessName: ci } }] } : {}),
  };
  const [rows, total, branches, vendors] = await Promise.all([
    db.invoice.findMany({ where, orderBy: [{ submittedAt: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { branch: { select: { name: true, code: true } }, vendor: { select: { businessName: true } } } }),
    db.invoice.count({ where }),
    db.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.vendorProfile.findMany({ orderBy: { businessName: "asc" }, select: { id: true, businessName: true } }),
  ]);
  const qs = new URLSearchParams(Object.entries({ ...sp, outstanding: pay === "outstanding" ? "1" : undefined }).filter(([k, v]) => v && k !== "page" && k !== "pay") as [string, string][]);

  return (
    <>
      <PageHeader title={t("adminTitle")} description={t("adminDescription")} actions={<ExportButton report="invoices" query={qs.toString()} />} />
      <FilterBar
        search={{ name: "q", placeholder: t("searchPlaceholder"), value: q }}
        selects={[
          { name: "status", label: t("status"), value: status ?? "", options: STATUSES.map((s) => ({ value: s, label: ts(s) })) },
          { name: "pay", label: t("paymentState"), value: pay ?? "", options: [{ value: "outstanding", label: t("outstandingOnly") }, { value: "paid", label: ts("PAID") }] },
          { name: "branch", label: tn("branches"), value: branch ?? "", options: branches.map((b) => ({ value: b.id, label: b.name })) },
          { name: "vendor", label: t("vendor"), value: vendor ?? "", options: vendors.map((v) => ({ value: v.id, label: v.businessName })) },
        ]}
        dates={[{ name: "from", label: "↦", value: from ?? "" }, { name: "to", label: "↤", value: to ?? "" }]}
      />
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={FileText} title={t("emptyAdmin")} />
        ) : (
          <>
            <InvoiceTable rows={rows} showVendor href={(id) => `/admin/invoices/${id}`} />
            <Pagination page={page} total={total} sp={sp} />
          </>
        )}
      </Card>
    </>
  );
}
