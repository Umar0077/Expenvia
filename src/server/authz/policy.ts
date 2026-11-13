/**
 * Centralized authorization policy. Pure functions — no DB access — so every
 * rule is unit-testable. Services load the minimal resource facts and call
 * these; a `false` result must always become a 403/redirect + audit DENIED.
 *
 * Deny by default: any action/role combination not listed returns false.
 */
import type { ExpenseStatus, InvoiceStatus, Role } from "@/generated/prisma/enums";

export interface Subject {
  userId: string;
  role: Role;
  /** USER: currently assigned branch (null if unassigned). */
  activeBranchId?: string | null;
  /** VENDOR: vendor profile id + active branch assignments. */
  vendorId?: string | null;
  vendorBranchIds?: readonly string[];
}

export interface ExpenseFacts {
  ownerId: string;
  branchId: string;
  status: ExpenseStatus;
}

export interface InvoiceFacts {
  vendorId: string;
  branchId: string;
  status: InvoiceStatus;
}

const isAdmin = (s: Subject) => s.role === "SUPER_ADMIN";

// ── Admin-only capabilities ──
export type AdminCapability =
  | "branch.manage"
  | "registration.review"
  | "user.manage"
  | "vendor.manage"
  | "assignment.manage"
  | "category.manage"
  | "expense.review"
  | "invoice.review"
  | "payment.record"
  | "reconciliation.manage"
  | "report.view"
  | "report.export"
  | "audit.view"
  | "settings.manage"
  | "org.analytics";

export function canAdmin(s: Subject, _cap: AdminCapability): boolean {
  return isAdmin(s);
}

// ── Expenses ──
const OWNER_EDITABLE: readonly ExpenseStatus[] = ["DRAFT", "REVISION_REQUESTED"];
const REVIEWABLE: readonly ExpenseStatus[] = ["SUBMITTED", "UNDER_REVIEW"];

export const expensePolicy = {
  create(s: Subject, branchId: string): boolean {
    return s.role === "USER" && !!s.activeBranchId && s.activeBranchId === branchId;
  },
  view(s: Subject, e: ExpenseFacts): boolean {
    if (isAdmin(s)) return true;
    return s.role === "USER" && e.ownerId === s.userId;
  },
  edit(s: Subject, e: ExpenseFacts): boolean {
    return s.role === "USER" && e.ownerId === s.userId && OWNER_EDITABLE.includes(e.status);
  },
  submit(s: Subject, e: ExpenseFacts): boolean {
    return expensePolicy.edit(s, e);
  },
  review(s: Subject, e: ExpenseFacts): boolean {
    return isAdmin(s) && REVIEWABLE.includes(e.status);
  },
};

// ── Invoices ──
const VENDOR_EDITABLE: readonly InvoiceStatus[] = ["DRAFT", "REVISION_REQUESTED"];
const INVOICE_REVIEWABLE: readonly InvoiceStatus[] = ["SUBMITTED", "UNDER_REVIEW"];
const PAYABLE: readonly InvoiceStatus[] = ["APPROVED", "PARTIALLY_PAID"];

export const invoicePolicy = {
  create(s: Subject, branchId: string): boolean {
    return s.role === "VENDOR" && !!s.vendorId && (s.vendorBranchIds ?? []).includes(branchId);
  },
  view(s: Subject, inv: InvoiceFacts): boolean {
    if (isAdmin(s)) return true;
    return s.role === "VENDOR" && !!s.vendorId && inv.vendorId === s.vendorId;
  },
  edit(s: Subject, inv: InvoiceFacts): boolean {
    return (
      s.role === "VENDOR" &&
      !!s.vendorId &&
      inv.vendorId === s.vendorId &&
      VENDOR_EDITABLE.includes(inv.status) &&
      // assignment may have been removed since the draft was created
      (s.vendorBranchIds ?? []).includes(inv.branchId)
    );
  },
  submit(s: Subject, inv: InvoiceFacts): boolean {
    return invoicePolicy.edit(s, inv);
  },
  review(s: Subject, inv: InvoiceFacts): boolean {
    return isAdmin(s) && INVOICE_REVIEWABLE.includes(inv.status);
  },
  recordPayment(s: Subject, inv: InvoiceFacts): boolean {
    // Approval ≠ payment: only approved/partially-paid invoices accept payments.
    return isAdmin(s) && PAYABLE.includes(inv.status);
  },
};

// ── Branch data ──
export const branchPolicy = {
  viewFinancials(s: Subject): boolean {
    return isAdmin(s);
  },
  /** Vendors may see basic info (name/city) of their own assigned branches only. */
  viewBasic(s: Subject, branchId: string): boolean {
    if (isAdmin(s)) return true;
    if (s.role === "VENDOR") return (s.vendorBranchIds ?? []).includes(branchId);
    if (s.role === "USER") return s.activeBranchId === branchId;
    return false;
  },
};

// ── Audit ──
export const auditPolicy = {
  view(s: Subject): boolean {
    return isAdmin(s);
  },
};
