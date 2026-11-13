import {
  BarChart3,
  Bell,
  Building2,
  ClipboardCheck,
  CreditCard,
  FilePlus2,
  FileText,
  FolderTree,
  LayoutDashboard,
  Mail,
  Package,
  Receipt,
  ScrollText,
  Settings,
  Store,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/generated/prisma/enums";

export interface NavItem {
  href: string;
  /** key in the "nav" message namespace */
  label: string;
  icon: LucideIcon;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

// UX only — every route below independently enforces authorization on the server.
export const NAVIGATION: Record<Role, NavGroup[]> = {
  SUPER_ADMIN: [
    {
      label: "groupOverview",
      items: [
        { href: "/admin/dashboard", label: "dashboard", icon: LayoutDashboard },
        { href: "/admin/reports", label: "reports", icon: BarChart3 },
      ],
    },
    {
      label: "groupFinance",
      items: [
        { href: "/admin/approvals", label: "approvals", icon: ClipboardCheck },
        { href: "/admin/expenses", label: "expenses", icon: Receipt },
        { href: "/admin/invoices", label: "invoices", icon: FileText },
        { href: "/admin/payments", label: "payments", icon: CreditCard },
      ],
    },
    {
      label: "groupOrganization",
      items: [
        { href: "/admin/branches", label: "branches", icon: Building2 },
        { href: "/admin/users", label: "users", icon: Users },
        { href: "/admin/vendors", label: "vendors", icon: Store },
        { href: "/admin/registrations", label: "registrations", icon: UserCheck },
        { href: "/admin/categories", label: "categories", icon: FolderTree },
      ],
    },
    {
      label: "groupSystem",
      items: [
        { href: "/admin/audit-logs", label: "auditLogs", icon: ScrollText },
        { href: "/admin/email-delivery", label: "emailDelivery", icon: Mail },
        { href: "/admin/notifications", label: "notifications", icon: Bell },
        { href: "/admin/settings", label: "settings", icon: Settings },
      ],
    },
  ],
  USER: [
    {
      label: "groupOverview",
      items: [
        { href: "/user/dashboard", label: "dashboard", icon: LayoutDashboard },
        { href: "/user/expenses", label: "myExpenses", icon: Receipt },
        { href: "/user/expenses/new", label: "newExpense", icon: FilePlus2 },
      ],
    },
    {
      label: "groupSystem",
      items: [
        { href: "/user/notifications", label: "notifications", icon: Bell },
        { href: "/user/settings", label: "settings", icon: Settings },
      ],
    },
  ],
  VENDOR: [
    {
      label: "groupOverview",
      items: [
        { href: "/vendor/dashboard", label: "dashboard", icon: LayoutDashboard },
        { href: "/vendor/invoices", label: "invoices", icon: FileText },
        { href: "/vendor/invoices/new", label: "newInvoice", icon: FilePlus2 },
        { href: "/vendor/supplies", label: "supplies", icon: Package },
        { href: "/vendor/branches", label: "myBranches", icon: Building2 },
      ],
    },
    {
      label: "groupSystem",
      items: [
        { href: "/vendor/notifications", label: "notifications", icon: Bell },
        { href: "/vendor/settings", label: "settings", icon: Settings },
      ],
    },
  ],
};

/** Longest-prefix match so /user/expenses/new highlights "New expense", not "My expenses". */
export function activeHref(pathname: string, groups: NavGroup[]): string | undefined {
  let best: string | undefined;
  for (const g of groups)
    for (const i of g.items)
      if ((pathname === i.href || pathname.startsWith(`${i.href}/`)) && (!best || i.href.length > best.length)) best = i.href;
  return best;
}
