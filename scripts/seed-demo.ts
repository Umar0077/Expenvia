/**
 * DEMO DATA SEED — fictional records for executive demonstrations.
 *
 * Safety:
 *  - Refuses to run when NODE_ENV=production or ALLOW_DEMO_SEED != "true".
 *  - Refuses to run against a database that already contains non-demo
 *    business records (expenses/invoices/branches not tagged DEMO-), unless
 *    --force is passed for a disposable dev database.
 *  - No known/hardcoded passwords: a random password is generated per run and
 *    written ONLY to ./.demo-credentials.txt (gitignored).
 *  - Every branch code starts with "DEMO-", every email ends with @demo.expenvia.test,
 *    and every business name carries "(Demo)", so demo data is always recognizable.
 *
 * Reset: see docs/DEMO.md  (npm run db:reset-demo)
 */
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { calculateInvoice } from "../src/lib/finance/money";

if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEMO_SEED !== "true") {
  console.error("✖ Demo seeding is disabled. Set ALLOW_DEMO_SEED=true in a non-production environment.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const force = process.argv.includes("--force");

// Deterministic pseudo-random so demos look the same each reset.
let seed = 20261112;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
const money = (lo: number, hi: number) => (Math.round(between(lo, hi) / 10) * 10).toFixed(2);
const dayOffset = (monthsAgo: number, day: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsAgo, Math.min(day, 28)));
};

const BRANCHES = [
  { code: "DEMO-LHR", name: "Lahore Head Office (Demo)", city: "Lahore", manager: "Imran Qureshi" },
  { code: "DEMO-KHI", name: "Karachi Port Office (Demo)", city: "Karachi", manager: "Sadia Rehman" },
  { code: "DEMO-ISB", name: "Islamabad Blue Area (Demo)", city: "Islamabad", manager: "Faisal Mirza" },
  { code: "DEMO-FSD", name: "Faisalabad Textile Hub (Demo)", city: "Faisalabad", manager: "Nadia Aslam" },
  { code: "DEMO-MUX", name: "Multan Regional Office (Demo)", city: "Multan", manager: "Usman Tariq" },
];
const EMPLOYEES = [
  ["Ayesha Siddiqui", 0], ["Bilal Ahmed", 0], ["Hira Javed", 1], ["Kamran Shah", 1], ["Mehwish Ali", 2], ["Omar Farooq", 2], ["Zainab Hussain", 3], ["Hamza Raza", 4],
] as const;
const VENDORS = [
  { name: "Al-Noor Stationers (Demo)", contact: "Tariq Noor", category: "Office supplies", branches: [0, 1, 2], items: [["A4 copy paper 80gsm", "ream", 1150, 1450], ["Toner cartridge 85A", "pcs", 8500, 11000], ["Box files", "pcs", 180, 320]] },
  { name: "Crescent IT Services (Demo)", contact: "Saima Khalid", category: "IT services", branches: [0, 2, 4], items: [["Network maintenance (monthly)", "month", 35000, 55000], ["Laptop SSD upgrade", "pcs", 14000, 19000], ["Wi-Fi access point", "pcs", 18000, 26000]] },
  { name: "Indus Facility Care (Demo)", contact: "Rashid Mehmood", category: "Cleaning", branches: [1, 3], items: [["Office deep cleaning", "visit", 22000, 30000], ["Janitorial supplies kit", "kit", 6500, 9500]] },
  { name: "Ravi Electricals (Demo)", contact: "Adnan Butt", category: "Repairs", branches: [0, 3, 4], items: [["AC servicing", "unit", 4500, 7000], ["LED panel replacement", "pcs", 3200, 4800], ["Generator maintenance", "visit", 25000, 40000]] },
  { name: "Margalla Furnishings (Demo)", contact: "Sana Iqbal", category: "Furniture", branches: [2], items: [["Ergonomic chair", "pcs", 28000, 36000], ["Meeting table", "pcs", 85000, 120000]] },
];
const EXPENSE_TITLES: Record<string, string[]> = {
  "office-supplies": ["Printer paper for reception", "Stationery restock", "Whiteboard markers and dusters"],
  utilities: ["Electricity bill top-up", "Water dispenser refills", "Gas bill"],
  maintenance: ["Plumbing repair in washroom", "Door lock replacement", "Office painting touch-ups"],
  "internet-communications": ["Mobile data packages", "Backup internet device", "Landline bill"],
  transportation: ["Client visit fuel", "Courier charges", "Ride-hailing for bank visit"],
  "office-equipment": ["Extension boards", "Desk lamp", "Calculator for accounts"],
  cleaning: ["Floor cleaner and mops", "Hand wash refills"],
  repairs: ["Ceiling fan repair", "Laptop keyboard repair"],
  miscellaneous: ["Team tea and refreshments", "Visitor parking fees"],
};

async function main() {
  const foreign = await db.branch.count({ where: { NOT: { code: { startsWith: "DEMO-" } } } });
  if (foreign > 0 && !force) {
    console.error(`✖ This database contains ${foreign} non-demo branch(es). Demo data must never mix with real records.\n  Use a separate demo database (see docs/DEMO.md), or pass --force on a disposable dev database.`);
    process.exit(1);
  }
  if ((await db.branch.count({ where: { code: { startsWith: "DEMO-" } } })) > 0) {
    console.error("✖ Demo data already present. Reset the demo database first (npm run db:reset-demo).");
    process.exit(1);
  }

  const password = `Demo-${randomBytes(9).toString("base64url")}-1`;
  const passwordHash = await hash(password, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const now = new Date();

  // Admin (demo-only account)
  const admin = await db.user.create({ data: { email: "ceo@demo.expenvia.test", fullName: "Demo Super Admin", passwordHash, role: "SUPER_ADMIN", status: "ACTIVE", emailVerifiedAt: now, preferences: { create: {} } } });
  const audit = (data: Omit<Prisma.AuditLogUncheckedCreateInput, "requestId">) => db.auditLog.create({ data: { ...data, requestId: `demo-${randomUUID()}` } });

  // Categories (reference data; idempotent)
  const CATS: [string, string, string][] = [
    ["office-supplies", "Office supplies", "دفتری سامان"], ["utilities", "Utilities", "یوٹیلیٹیز"], ["maintenance", "Maintenance", "دیکھ بھال"],
    ["internet-communications", "Internet & communications", "انٹرنیٹ اور مواصلات"], ["transportation", "Transportation", "نقل و حمل"],
    ["office-equipment", "Office equipment", "دفتری آلات"], ["cleaning", "Cleaning", "صفائی"], ["repairs", "Repairs", "مرمت"], ["miscellaneous", "Miscellaneous", "متفرق"],
  ];
  const cats: { id: string; key: string }[] = [];
  for (const [key, en, ur] of CATS) cats.push(await db.expenseCategory.upsert({ where: { key }, create: { key, nameEn: en, nameUr: ur, createdById: admin.id }, update: {} }));

  // Branches
  const branches: { id: string; code: string }[] = [];
  for (const b of BRANCHES) {
    const br = await db.branch.create({ data: { code: b.code, name: b.name, city: b.city, country: "Pakistan", managerName: b.manager, contactPhone: "+92 300 0000000", createdById: admin.id, createdAt: dayOffset(13, 2) } });
    branches.push(br);
    await audit({ actorId: admin.id, actorRole: "SUPER_ADMIN", action: "branch.created", entityType: "branch", entityId: br.id, branchId: br.id, summary: { code: br.code }, createdAt: dayOffset(13, 2) });
  }

  // Employees
  const employees = [];
  for (const [i, [name, bIdx]] of EMPLOYEES.entries()) {
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@demo.expenvia.test`;
    const u = await db.user.create({
      data: {
        email, fullName: name, passwordHash, role: "USER", status: "ACTIVE", emailVerifiedAt: now, preferences: { create: {} },
        registration: { create: { requestedType: "USER", status: "APPROVED", termsAcceptedAt: dayOffset(12, 3), reviewedById: admin.id, reviewedAt: dayOffset(12, 4) } },
        branchAssignments: { create: { branchId: branches[bIdx]!.id, assignedById: admin.id, startedAt: dayOffset(12, 4) } },
      },
    });
    employees.push({ user: u, branch: branches[bIdx]! });
    await audit({ actorId: admin.id, actorRole: "SUPER_ADMIN", action: "registration.approved", entityType: "user", entityId: u.id, branchId: branches[bIdx]!.id, createdAt: dayOffset(12, 4 + i) });
  }

  // Vendors
  const vendors = [];
  for (const v of VENDORS) {
    const email = `${v.contact.toLowerCase().replace(/[^a-z]+/g, ".")}@demo.expenvia.test`;
    const u = await db.user.create({
      data: {
        email, fullName: v.contact, passwordHash, role: "VENDOR", status: "ACTIVE", emailVerifiedAt: now, phone: "+92 321 0000000", preferences: { create: {} },
        registration: { create: { requestedType: "VENDOR", status: "APPROVED", businessName: v.name, businessCategory: v.category, termsAcceptedAt: dayOffset(12, 5), reviewedById: admin.id, reviewedAt: dayOffset(12, 6) } },
      },
    });
    const profile = await db.vendorProfile.create({
      data: {
        userId: u.id, businessName: v.name, contactPerson: v.contact, businessEmail: email, businessPhone: "+92 321 0000000", businessCategory: v.category,
        businessAddress: "Fictional address for demonstration", taxIdentifier: `DEMO-NTN-${Math.floor(between(1000000, 9999999))}`, paymentDetails: "Demo Bank Ltd · Account title: (fictional)",
        branchAssignments: { create: v.branches.map((bi) => ({ branchId: branches[bi]!.id, assignedById: admin.id, assignedAt: dayOffset(12, 6) })) },
      },
    });
    vendors.push({ user: u, profile, def: v });
  }

  // Expenses: 12 months of history, mostly approved; recent months include pending/rejected/revision.
  let expenseSeq = 0;
  for (let m = 11; m >= 0; m--) {
    for (const emp of employees) {
      const n = Math.floor(between(1, 4));
      for (let k = 0; k < n; k++) {
        const cat = pick(cats);
        const amount = money(cat.key === "utilities" ? 3000 : 600, cat.key === "maintenance" || cat.key === "repairs" ? 28000 : 12000);
        const date = dayOffset(m, Math.floor(between(1, 28)));
        const r = rnd();
        const status = m > 1 ? (r < 0.88 ? "APPROVED" : "REJECTED") : r < 0.45 ? "APPROVED" : r < 0.75 ? "SUBMITTED" : r < 0.85 ? "UNDER_REVIEW" : r < 0.93 ? "REVISION_REQUESTED" : "DRAFT";
        const submittedAt = status === "DRAFT" ? null : new Date(date.getTime() + 36e5 * 6);
        const reviewedAt = ["APPROVED", "REJECTED", "REVISION_REQUESTED"].includes(status) ? new Date(date.getTime() + 36e5 * between(8, 72)) : null;
        const number = `EXP-EXP-DEMO-${String(++expenseSeq).padStart(6, "0")}`;
        const e = await db.expense.create({
          data: {
            number, ownerId: emp.user.id, branchId: emp.branch.id, categoryId: cat.id, title: pick(EXPENSE_TITLES[cat.key] ?? ["Office expense"]), amount, expenseDate: date,
            payeeName: "Local supplier (fictional)", paymentMethod: pick(["CASH", "CARD", "MOBILE_WALLET"]), status: status as never, submittedAt, reviewedAt,
            reviewedById: reviewedAt ? admin.id : null, reviewNote: status === "REJECTED" ? "Personal expense — not reimbursable (demo)" : status === "REVISION_REQUESTED" ? "Please attach the receipt (demo)" : null,
            createdAt: date,
          },
        });
        const hist: Prisma.ExpenseStatusHistoryCreateManyInput[] = [{ expenseId: e.id, toStatus: "DRAFT", actorId: emp.user.id, createdAt: date }];
        if (submittedAt) hist.push({ expenseId: e.id, fromStatus: "DRAFT", toStatus: "SUBMITTED", actorId: emp.user.id, createdAt: submittedAt });
        if (status === "UNDER_REVIEW") hist.push({ expenseId: e.id, fromStatus: "SUBMITTED", toStatus: "UNDER_REVIEW", actorId: admin.id, createdAt: new Date(submittedAt!.getTime() + 36e5) });
        if (reviewedAt) hist.push({ expenseId: e.id, fromStatus: "SUBMITTED", toStatus: status as never, actorId: admin.id, note: e.reviewNote, createdAt: reviewedAt });
        await db.expenseStatusHistory.createMany({ data: hist });
        if (submittedAt) await audit({ actorId: emp.user.id, actorRole: "USER", action: "expense.submitted", entityType: "expense", entityId: e.id, branchId: emp.branch.id, summary: { number, amount }, createdAt: submittedAt });
        if (reviewedAt) await audit({ actorId: admin.id, actorRole: "SUPER_ADMIN", action: status === "APPROVED" ? "expense.approved" : status === "REJECTED" ? "expense.rejected" : "expense.revision_requested", entityType: "expense", entityId: e.id, branchId: emp.branch.id, summary: { number, amount }, createdAt: reviewedAt });
      }
    }
  }

  // Invoices with line items, approvals and payments
  let invSeq = 0;
  for (let m = 11; m >= 0; m--) {
    for (const v of vendors) {
      if (rnd() < 0.35) continue;
      const branch = branches[pick(v.def.branches)]!;
      const lines = Array.from({ length: Math.floor(between(1, 4)) }, () => {
        const [itemName, unit, lo, hi] = pick(v.def.items) as unknown as [string, string, number, number];
        return { itemName, unit, quantity: String(Math.floor(between(1, 12))), unitPrice: money(lo, hi), taxRate: pick(["0", "16", "17"]), discount: rnd() < 0.25 ? money(100, 900) : "0" };
      });
      const totals = calculateInvoice(lines);
      const invoiceDate = dayOffset(m, Math.floor(between(1, 26)));
      const r = rnd();
      const status = m > 2 ? (r < 0.75 ? "PAID" : r < 0.9 ? "PARTIALLY_PAID" : "REJECTED") : m > 0 ? (r < 0.4 ? "PAID" : r < 0.7 ? "APPROVED" : "PARTIALLY_PAID") : r < 0.5 ? "SUBMITTED" : r < 0.75 ? "UNDER_REVIEW" : r < 0.9 ? "APPROVED" : "DRAFT";
      const isDraft = status === "DRAFT";
      const number = isDraft ? `DRAFT-DEMO${String(invSeq + 1).padStart(6, "0")}` : `EXP-INV-DEMO-${String(++invSeq).padStart(6, "0")}`;
      const grand = totals.grandTotal;
      const paidAmount = status === "PAID" ? grand : status === "PARTIALLY_PAID" ? grand.times(between(0.3, 0.7)).toDecimalPlaces(2) : grand.times(0);
      const submittedAt = isDraft ? null : new Date(invoiceDate.getTime() + 36e5 * 4);
      const approvedAt = ["APPROVED", "PARTIALLY_PAID", "PAID"].includes(status) ? new Date(invoiceDate.getTime() + 36e5 * between(24, 96)) : null;
      const inv = await db.invoice.create({
        data: {
          number, vendorId: v.profile.id, branchId: branch.id, currency: "PKR", invoiceDate, supplyDate: invoiceDate, dueDate: new Date(invoiceDate.getTime() + 864e5 * 30),
          paymentTerms: "Net 30 days (demo)", notes: "Fictional invoice for demonstration purposes.",
          subtotal: totals.subtotal.toFixed(2), discountTotal: totals.discountTotal.toFixed(2), taxTotal: totals.taxTotal.toFixed(2), grandTotal: grand.toFixed(2), amountPaid: paidAmount.toFixed(2),
          status: "DRAFT", submittedAt, approvedAt, reviewNote: status === "REJECTED" ? "Duplicate of an earlier invoice (demo)" : null, createdAt: invoiceDate,
          lineItems: { create: lines.map((l, i) => ({ position: i + 1, ...l, quantity: l.quantity, lineSubtotal: totals.lines[i]!.lineSubtotal.toFixed(2), lineTax: totals.lines[i]!.lineTax.toFixed(2), lineTotal: totals.lines[i]!.lineTotal.toFixed(2), discount: totals.lines[i]!.discount.toFixed(2) })) },
        },
      });
      // Status set after lines exist (the DB locks lines of submitted invoices).
      if (!isDraft) await db.invoice.update({ where: { id: inv.id }, data: { status: status as never, snapshot: { versions: [{ submittedAt: submittedAt!.toISOString(), number, totals: { grandTotal: grand.toFixed(2) } }] } } });
      const hist: Prisma.InvoiceStatusHistoryCreateManyInput[] = [{ invoiceId: inv.id, toStatus: "DRAFT", actorId: v.user.id, createdAt: invoiceDate }];
      if (submittedAt) hist.push({ invoiceId: inv.id, fromStatus: "DRAFT", toStatus: "SUBMITTED", actorId: v.user.id, createdAt: submittedAt });
      if (status === "UNDER_REVIEW") hist.push({ invoiceId: inv.id, fromStatus: "SUBMITTED", toStatus: "UNDER_REVIEW", actorId: admin.id, createdAt: new Date(submittedAt!.getTime() + 36e5) });
      if (approvedAt) hist.push({ invoiceId: inv.id, fromStatus: "SUBMITTED", toStatus: "APPROVED", actorId: admin.id, createdAt: approvedAt });
      if (status === "REJECTED") hist.push({ invoiceId: inv.id, fromStatus: "SUBMITTED", toStatus: "REJECTED", actorId: admin.id, note: inv.reviewNote, createdAt: new Date(submittedAt!.getTime() + 864e5) });
      await db.invoiceStatusHistory.createMany({ data: hist });
      if (submittedAt) await audit({ actorId: v.user.id, actorRole: "VENDOR", action: "invoice.submitted", entityType: "invoice", entityId: inv.id, branchId: branch.id, summary: { number, grandTotal: grand.toFixed(2) }, createdAt: submittedAt });
      if (approvedAt) await audit({ actorId: admin.id, actorRole: "SUPER_ADMIN", action: "invoice.approved", entityType: "invoice", entityId: inv.id, branchId: branch.id, summary: { number }, createdAt: approvedAt });
      if (!paidAmount.isZero()) {
        const payDate = new Date(approvedAt!.getTime() + 864e5 * between(3, 20));
        const safePay = payDate > now ? now : payDate;
        await db.invoicePayment.create({ data: { invoiceId: inv.id, amount: paidAmount.toFixed(2), paymentDate: new Date(safePay.toISOString().slice(0, 10)), method: "BANK_TRANSFER", reference: `DEMO-TRX-${Math.floor(between(100000, 999999))}`, idempotencyKey: randomUUID(), recordedById: admin.id, createdAt: safePay } });
        await db.invoiceStatusHistory.create({ data: { invoiceId: inv.id, fromStatus: "APPROVED", toStatus: status as never, actorId: admin.id, createdAt: safePay } });
        await audit({ actorId: admin.id, actorRole: "SUPER_ADMIN", action: "payment.recorded", entityType: "invoice", entityId: inv.id, branchId: branch.id, summary: { number, amount: paidAmount.toFixed(2) }, createdAt: safePay });
      }
    }
  }

  // A pending registration and some notifications for the admin
  const pendingUser = await db.user.create({
    data: { email: "new.applicant@demo.expenvia.test", fullName: "Rabia Anwar", passwordHash, status: "PENDING_APPROVAL", emailVerifiedAt: now, preferences: { create: {} },
      registration: { create: { requestedType: "VENDOR", businessName: "Shalimar Catering (Demo)", businessCategory: "Catering", applicantNote: "We supply staff lunches to offices in Lahore. (demo)", termsAcceptedAt: now } } },
  });
  await db.notification.createMany({
    data: [
      { userId: admin.id, type: "registration_pending", params: { name: pendingUser.fullName, type: "VENDOR" }, href: "/admin/registrations" },
      { userId: admin.id, type: "invoice_submitted", params: { vendor: vendors[0]!.def.name, number: `EXP-INV-DEMO-${String(invSeq).padStart(6, "0")}` }, href: "/admin/invoices?status=SUBMITTED" },
    ],
  });
  await db.systemSetting.upsert({ where: { key: "orgName" }, create: { key: "orgName", value: "Demo Organization (fictional)", updatedById: admin.id }, update: {} });

  const lines = [
    "Expenvia DEMO credentials (fictional accounts — local demo database only).",
    "This file is gitignored. Delete it after the demonstration.",
    "",
    `Password for every demo account: ${password}`,
    "",
    "Super Admin:  ceo@demo.expenvia.test",
    ...employees.map((e) => `Employee:     ${e.user.email}   (${e.branch.code})`),
    ...vendors.map((v) => `Vendor:       ${v.user.email}   (${v.def.name})`),
  ];
  writeFileSync(".demo-credentials.txt", lines.join("\n") + "\n", { mode: 0o600 });
  console.log(`✔ Demo data seeded: ${branches.length} branches, ${employees.length} employees, ${vendors.length} vendors, ${expenseSeq} expenses, ${invSeq} invoices.`);
  console.log("  Credentials written to .demo-credentials.txt (not printed here).");
}

main()
  .catch((e) => {
    console.error("✖", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
