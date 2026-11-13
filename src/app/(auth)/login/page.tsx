import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignInForm } from "@/components/auth/auth-forms";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { dashboardFor, getSessionState, statusRoute } from "@/server/auth/session";
import { devAccessEnabled } from "@/server/dev-access";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("signIn") };
}

export default async function LoginPage() {
  const state = await getSessionState();
  if (state.kind === "active") redirect(dashboardFor(state.actor.role));
  if (state.kind === "inactive") redirect(statusRoute(state.status));
  const t = await getTranslations("auth");
  return (
    <>
      <AuthHeading title={t("signInTitle")} body={t("signInBody")} />
      <SignInForm />
      {devAccessEnabled() && (
        <Link href="/dev-access" className="mt-6 flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-warning/50 bg-warning-soft/60 px-4 py-2.5 text-sm font-medium text-warning hover:border-warning">
          <FlaskConical className="size-4" /> {(await getTranslations("devAccess"))("link")}
        </Link>
      )}
    </>
  );
}
