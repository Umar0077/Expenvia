import type { Metadata } from "next";
import Link from "next/link";
import { devAccessEnabled } from "@/server/dev-access";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignUpForm } from "@/components/auth/auth-forms";
import { dashboardFor, getSessionState, statusRoute } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("requestAccess") };
}

export default async function SignUpPage() {
  const state = await getSessionState();
  if (state.kind === "active") redirect(dashboardFor(state.actor.role));
  if (state.kind === "inactive") redirect(statusRoute(state.status));
  const t = await getTranslations("auth");
  return (
    <div className="py-4">
      <AuthHeading title={t("signUpTitle")} body={t("signUpBody")} />
      {devAccessEnabled() && (
        <Link href="/dev-access" className="mb-6 block rounded-[var(--radius-md)] border border-dashed border-warning/50 bg-warning-soft/60 px-4 py-3 text-center text-sm font-medium text-warning hover:border-warning">
          {(await getTranslations("devAccess"))("link")}
        </Link>
      )}
      <SignUpForm />
    </div>
  );
}
