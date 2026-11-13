import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

/** ExpenviaCard */
export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("surface-card", className)} {...p}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("atelier-header flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5", className)}>
      <div className="min-w-0">
        <h2 className="text-title font-semibold tracking-[-0.01em] text-text">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 sm:mb-6">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-xs font-medium text-muted">{eyebrow}</div>}
        <h1 className="font-display text-page font-semibold tracking-[-0.02em] text-text sm:text-page-lg">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-body text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-surface-2 text-muted border-border",
  brand: "bg-brand-soft text-brand border-brand/20",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/20",
  info: "bg-info-soft text-info border-info/20",
  copper: "bg-copper-soft text-copper border-copper/25",
} as const;
export type BadgeTone = keyof typeof BADGE_TONES;

/** ExpenviaBadge — always carries text, never color alone. */
export function Badge({ tone = "neutral", children, className, dot = true }: { tone?: BadgeTone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", BADGE_TONES[tone], className)}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  REVISION_REQUESTED: "copper",
  PARTIALLY_PAID: "warning",
  PAID: "brand",
  ACTIVE: "success",
  INACTIVE: "neutral",
  PENDING: "warning",
  PENDING_APPROVAL: "warning",
  PENDING_VERIFICATION: "neutral",
  INFO_REQUESTED: "copper",
  SUSPENDED: "danger",
};

/** ExpenviaEmptyState */
export function EmptyState({ icon: Icon, title, body, action, className }: { icon: LucideIcon; title: React.ReactNode; body?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center sm:py-12", className)}>
      <span className="grid size-12 place-items-center rounded-full bg-surface-sage text-brand">
        <Icon className="size-5" />
      </span>
      <p className="mt-4 text-body font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** ExpenviaSkeleton */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-[var(--radius-sm)] bg-surface-2", className)} />;
}

/** Table primitives — subtle rows, end-aligned numbers via `num`. */
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, num, className }: { children?: React.ReactNode; num?: boolean; className?: string }) {
  return (
    <th scope="col" className={cn("whitespace-nowrap border-b border-border bg-surface-2/50 px-4 py-2.5 text-start text-2xs font-semibold uppercase tracking-[0.05em] text-muted", num && "text-end", className)}>
      {children}
    </th>
  );
}
export function Td({ children, num, className }: { children?: React.ReactNode; num?: boolean; className?: string }) {
  return <td className={cn("border-b border-border px-4 py-3 align-middle", num && "tabular text-end", className)}>{children}</td>;
}
export function Tr({ children, className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("transition-colors duration-150 hover:bg-surface-2/60 [&:last-child>td]:border-b-0", className)} {...p}>
      {children}
    </tr>
  );
}
