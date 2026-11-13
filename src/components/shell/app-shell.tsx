"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { localeDirection, type AppLocale } from "@/i18n/config";
import { Bell, ChevronsLeft, LogOut, Menu, X } from "lucide-react";
import { GlobalSearch } from "@/components/shell/global-search";
import { AmbientBackground } from "@/components/ambient/ambient-background";
import { DropdownMenu } from "radix-ui";
import { ExpenviaLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/preferences/theme-toggle";
import { LanguageSwitcher } from "@/components/preferences/language-switcher";
import { activeHref, NAVIGATION, type NavGroup } from "@/lib/navigation";
import { cn } from "@/lib/cn";
import { duration, spring } from "@/lib/motion";
import type { Role } from "@/generated/prisma/enums";
import { signOutAction } from "@/server/actions/auth";

const COLLAPSE_KEY = "expenvia-sidebar-collapsed";
/** Forms, builders, approvals, detail and settings pages stay perfectly still. */
const CALM_ROUTE = /\/(new|approvals|settings|supplies|registrations)(\/|$)|\/(invoices|expenses|branches)\/[0-9a-f-]{36}/;

export interface ShellUser {
  fullName: string;
  email: string;
  role: Role;
}

const NOTIFICATIONS_HREF: Record<Role, string> = {
  SUPER_ADMIN: "/admin/notifications",
  USER: "/user/notifications",
  VENDOR: "/vendor/notifications",
};

export function AppShell({ user, unread = 0, children }: { user: ShellUser; unread?: number; children: React.ReactNode }) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const rtl = localeDirection[useLocale() as AppLocale] === "rtl";
  const pathname = usePathname();
  const groups = NAVIGATION[user.role];
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  return (
    <div
      className="app-shell min-h-dvh lg:grid lg:transition-[grid-template-columns] lg:duration-300 lg:ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{ gridTemplateColumns: `${collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)"} minmax(0,1fr)` }}
    >
      <a href="#app-main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-4 focus:py-2">
        {tc("skipToContent")}
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-e border-border bg-surface lg:flex" aria-label={t("primary")}>
        <div className={cn("flex h-[var(--header-h)] items-center border-b border-border", collapsed ? "justify-center px-0" : "px-5")}>
          <Link href={groups[0]!.items[0]!.href} aria-label="Expenvia" className="rounded-md">
            <ExpenviaLogo size="sidebar" showWordmark={!collapsed} />
          </Link>
        </div>
        <SidebarNav groups={groups} pathname={pathname} collapsed={collapsed} layoutGroup="desktop" />
        <div className="border-t border-border p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            aria-label={collapsed ? t("expand") : t("collapse")}
            aria-expanded={!collapsed}
            className={cn("w-full", collapsed ? "justify-center px-0" : "justify-start")}
          >
            <ChevronsLeft className={cn("transition-transform duration-300", collapsed && "rotate-180", "rtl:-scale-x-100")} />
            {!collapsed && <span>{t("collapse")}</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile / tablet drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.standard }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={t("primary")}
              className="fixed inset-y-0 start-0 z-50 flex w-[min(86vw,var(--sidebar-w))] flex-col bg-surface shadow-[var(--shadow-overlay)] lg:hidden"
              initial={{ x: rtl ? "100%" : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: rtl ? "100%" : "-100%" }}
              transition={spring.panel}
            >
              <div className="flex h-[var(--header-h)] items-center justify-between border-b border-border px-4">
                <ExpenviaLogo size="sidebar" />
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label={t("closeMenu")}>
                  <X />
                </Button>
              </div>
              <SidebarNav groups={groups} pathname={pathname} collapsed={false} layoutGroup="mobile" />
              <div className="border-t border-border p-4">
                <LanguageSwitcher />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="relative isolate flex min-w-0 flex-col">
        {/* Ambient band: top area only, fades out before content; frozen on work surfaces. */}
        <AmbientBackground
          variant={CALM_ROUTE.test(pathname) ? "static" : "app"}
          className="-z-10 !bottom-auto h-[300px] [mask-image:linear-gradient(to_bottom,black_35%,transparent)]"
        />
        <header className="sticky top-0 z-30 flex h-[var(--header-h)] items-center gap-2 border-b border-border/70 bg-bg/75 px-3 backdrop-blur-md sm:gap-3 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label={t("openMenu")} aria-expanded={mobileOpen}>
            <Menu />
          </Button>
          <div className="flex-1" />
          <GlobalSearch role={user.role} />
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <Button asChild variant="ghost" size="icon" className="relative">
            <Link href={NOTIFICATIONS_HREF[user.role]} aria-label={unread > 0 ? `${t("notifications")} (${unread})` : t("notifications")}>
              <Bell />
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={spring.jelly}
                  className="tabular absolute end-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-copper px-1 text-[10px] font-bold leading-4 text-white"
                >
                  {unread > 99 ? "99+" : unread}
                </motion.span>
              )}
            </Link>
          </Button>
          <ThemeToggle />
          <UserMenu user={user} />
        </header>
        <main id="app-main" className="relative min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          <div className="mx-auto w-full max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarNav({ groups, pathname, collapsed, layoutGroup }: { groups: NavGroup[]; pathname: string; collapsed: boolean; layoutGroup: string }) {
  const t = useTranslations("nav");
  const current = activeHref(pathname, groups);
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {groups.map((g) => (
        <div key={g.label} className="mb-5 last:mb-0">
          <p
            className={cn(
              "mb-1.5 px-3 text-2xs font-semibold uppercase tracking-[0.08em] text-muted/80 transition-opacity duration-200",
              collapsed && "pointer-events-none h-0 opacity-0",
            )}
            aria-hidden={collapsed}
          >
            {t(g.label)}
          </p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active = item.href === current;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? t(item.label) : undefined}
                    className={cn(
                      "sidebar-link group relative flex min-h-10 items-center gap-3 rounded-[var(--radius-md)] text-sm font-medium transition-colors duration-150",
                      collapsed ? "justify-center px-0" : "px-3",
                      active ? "text-brand" : "text-muted hover:bg-surface-2 hover:text-text",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId={`nav-active-${layoutGroup}`}
                        transition={spring.soft}
                        className="absolute inset-0 rounded-[var(--radius-md)] bg-brand-soft"
                      />
                    )}
                    <item.icon className="relative size-[18px] shrink-0 transition-transform duration-150 group-hover:scale-105" />
                    <span className={cn("sidebar-label relative transition-opacity duration-200", collapsed && "sr-only")}>{t(item.label)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const t = useTranslations("nav");
  const rtl = useLocale() === "ur";
  const [, startSignOut] = useTransition();
  const tr = useTranslations("roles");
  const initials = user.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <DropdownMenu.Root dir={rtl ? "rtl" : "ltr"}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t("account")}
          className="flex items-center gap-2.5 rounded-full p-0.5 pe-2 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus sm:pe-3"
        >
          <span className="grid size-8 place-items-center rounded-full bg-brand text-xs font-semibold text-brand-fg">{initials}</span>
          <span className="hidden text-start leading-tight md:block">
            <span className="block max-w-40 truncate text-sm font-medium text-text">{user.fullName}</span>
            <span className="block text-2xs text-muted">{tr(user.role)}</span>
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-56 rounded-[var(--radius-lg)] border border-border bg-surface-elevated p-1.5 shadow-[var(--shadow-overlay)] data-[state=open]:animate-in"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-medium">{user.fullName}</p>
            <p className="ltr-data truncate text-xs text-muted">{user.email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          {/* Call the action directly: a <form> inside the menu would unmount before submitting. */}
          <DropdownMenu.Item
            onSelect={() => startSignOut(() => signOutAction())}
            className="flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft"
          >
            <LogOut className="size-4 rtl:-scale-x-100" /> {t("signOut")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
