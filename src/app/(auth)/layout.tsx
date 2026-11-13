import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { ExpenviaLogo } from "@/components/brand/logo";
import { AmbientBackground } from "@/components/ambient/ambient-background";
import { LanguageSwitcher } from "@/components/preferences/language-switcher";
import { ThemeToggle } from "@/components/preferences/theme-toggle";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth");
  return (
    <div className="auth-layout grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-[#13382c] p-12 text-[#eef2ec] lg:flex lg:flex-col lg:justify-between">
        <AmbientBackground variant="panel" />
        <svg aria-hidden className="absolute inset-0 size-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="auth-grid" width="36" height="36" patternUnits="userSpaceOnUse">
              <path d="M36 0H0V36" fill="none" stroke="#fff" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-grid)" />
        </svg>
        <Link href="/" className="relative z-10 inline-block w-fit rounded-md" aria-label="Expenvia">
          {/* Dark-variant artwork always: this panel is dark in both themes */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/expenvia-logo-dark.png" alt="Expenvia" style={{ height: "auto", width: 196 }} className="object-contain" />
        </Link>
        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-[2.1rem] font-semibold leading-tight tracking-[-0.02em]">{t("panelTitle")}</h2>
          <p className="mt-4 text-body leading-relaxed text-[#c9d6cd]">{t("panelBody")}</p>
          <ul className="mt-9 space-y-3.5">
            {[t("panelPoint1"), t("panelPoint2"), t("panelPoint3")].map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-[#dfe7e0]">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#7fcfab]" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-[#9fb3a6]">© {new Date().getFullYear()} Expenvia</p>
      </aside>

      {/* Form column */}
      <div className="relative isolate flex min-h-dvh flex-col">
        <AmbientBackground variant="auth" className="-z-10" />
        <header className="auth-header flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Link href="/" className="rounded-md lg:invisible" aria-label="Expenvia">
            <ExpenviaLogo size="auth" />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center sm:px-8">
          <div className="w-full max-w-[440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
