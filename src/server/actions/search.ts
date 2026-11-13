"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { getSessionState } from "@/server/auth/session";
import { loadSubject } from "@/server/authz/subject";

export interface SearchHit {
  kind: "branch" | "employee" | "vendor" | "expense" | "invoice" | "supply";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

const PER_KIND = 5;

/** Role-scoped search: every query is filtered server-side by what the actor may see. */
export async function searchAction(input: unknown): Promise<SearchHit[]> {
  const q = z.string().trim().min(2).max(80).safeParse(input);
  if (!q.success) return [];
  const state = await getSessionState();
  if (state.kind !== "active") return [];
  const actor = state.actor;
  const term = q.data;
  const ci = { contains: term, mode: "insensitive" as const };

  if (actor.role === "SUPER_ADMIN") {
    const [branches, users, vendors, expenses, invoices] = await Promise.all([
      db.branch.findMany({ where: { OR: [{ name: ci }, { code: ci }, { city: ci }] }, take: PER_KIND, select: { id: true, name: true, code: true, city: true } }),
      db.user.findMany({
        where: { role: "USER", OR: [{ fullName: ci }, { email: ci }] },
        take: PER_KIND,
        select: { id: true, fullName: true, email: true },
      }),
      db.vendorProfile.findMany({ where: { OR: [{ businessName: ci }, { contactPerson: ci }, { businessEmail: ci }] }, take: PER_KIND, select: { id: true, businessName: true, contactPerson: true } }),
      db.expense.findMany({
        where: { status: { not: "DRAFT" }, OR: [{ number: ci }, { title: ci }, { referenceNumber: ci }] },
        take: PER_KIND,
        orderBy: { createdAt: "desc" },
        select: { id: true, number: true, title: true },
      }),
      db.invoice.findMany({
        where: { status: { not: "DRAFT" }, OR: [{ number: ci }, { vendor: { businessName: ci } }] },
        take: PER_KIND,
        orderBy: { createdAt: "desc" },
        select: { id: true, number: true, vendor: { select: { businessName: true } } },
      }),
    ]);
    return [
      ...branches.map((b) => ({ kind: "branch" as const, id: b.id, title: b.name, subtitle: `${b.code} · ${b.city}`, href: `/admin/branches/${b.id}` })),
      ...users.map((u) => ({ kind: "employee" as const, id: u.id, title: u.fullName, subtitle: u.email, href: `/admin/users?id=${u.id}` })),
      ...vendors.map((v) => ({ kind: "vendor" as const, id: v.id, title: v.businessName, subtitle: v.contactPerson, href: `/admin/vendors?id=${v.id}` })),
      ...expenses.map((e) => ({ kind: "expense" as const, id: e.id, title: e.title, subtitle: e.number, href: `/admin/expenses?id=${e.id}` })),
      ...invoices.map((i) => ({ kind: "invoice" as const, id: i.id, title: i.number, subtitle: i.vendor.businessName, href: `/admin/invoices/${i.id}` })),
    ];
  }

  if (actor.role === "USER") {
    const expenses = await db.expense.findMany({
      where: { ownerId: actor.userId, OR: [{ number: ci }, { title: ci }, { referenceNumber: ci }, { payeeName: ci }] },
      take: PER_KIND * 2,
      orderBy: { createdAt: "desc" },
      select: { id: true, number: true, title: true },
    });
    return expenses.map((e) => ({ kind: "expense", id: e.id, title: e.title, subtitle: e.number, href: `/user/expenses/${e.id}` }));
  }

  const subject = await loadSubject(actor);
  if (!subject.vendorId) return [];
  const [invoices, supplies] = await Promise.all([
    db.invoice.findMany({
      where: { vendorId: subject.vendorId, number: ci },
      take: PER_KIND,
      orderBy: { createdAt: "desc" },
      select: { id: true, number: true, branch: { select: { name: true } } },
    }),
    db.vendorSupplyRecord.findMany({
      where: { vendorId: subject.vendorId, itemName: ci },
      take: PER_KIND,
      orderBy: { createdAt: "desc" },
      select: { id: true, itemName: true, branch: { select: { name: true } } },
    }),
  ]);
  return [
    ...invoices.map((i) => ({ kind: "invoice" as const, id: i.id, title: i.number, subtitle: i.branch.name, href: `/vendor/invoices/${i.id}` })),
    ...supplies.map((s) => ({ kind: "supply" as const, id: s.id, title: s.itemName, subtitle: s.branch.name, href: `/vendor/supplies` })),
  ];
}
