import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ExpenviaLogo } from "@/components/brand/logo";
import { AmbientBackground } from "@/components/ambient/ambient-background";
import { Button } from "@/components/ui/button";

export function StatusScreen({
  icon: Icon,
  tone = "brand",
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  tone?: "brand" | "warning" | "danger";
  title: string;
  body: string;
  action?: { href: string; label: string } | React.ReactNode;
}) {
  const toneClass = { brand: "bg-brand-soft text-brand", warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger" }[tone];
  return (
    <main className="relative isolate grid min-h-dvh place-items-center px-4 py-12">
      <AmbientBackground variant="auth" className="-z-10" />
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-block rounded-md" aria-label="Expenvia">
          <ExpenviaLogo height={34} />
        </Link>
        <div className="surface-card mt-8 p-8">
          <span className={`mx-auto grid size-12 place-items-center rounded-full ${toneClass}`}>
            <Icon className="size-6" />
          </span>
          <h1 className="font-display mt-5 text-xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          {action && (
            <div className="mt-7">
              {typeof action === "object" && action !== null && "href" in action ? (
                <Button asChild>
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ) : (
                action
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
