import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MailCheck } from "lucide-react";
import { AuthHeading, IconBadge } from "@/components/auth/auth-heading";
import { DevMailNotice } from "@/components/auth/dev-mail-notice";
import { ConfirmVerificationButton, ResendVerificationButton, SignOutButton } from "@/components/auth/status-actions";
import { dashboardFor, getSessionState, statusRoute } from "@/server/auth/session";
import { db } from "@/server/db";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = await getTranslations("auth");

  if (token) {
    return (
      <>
        <AuthHeading title={t("verifyTitle")} body={t("verifyConfirmBody")} icon={<IconBadge><MailCheck /></IconBadge>} />
        <ConfirmVerificationButton token={token} />
      </>
    );
  }

  const state = await getSessionState();
  if (state.kind === "active") redirect(dashboardFor(state.actor.role));
  if (state.kind !== "inactive") redirect("/login");
  if (state.status !== "PENDING_VERIFICATION") redirect(statusRoute(state.status));

  const user = await db.user.findUniqueOrThrow({ where: { id: state.userId }, select: { email: true } });
  return (
    <>
      <AuthHeading
        title={t("verifyTitle")}
        body={t.rich("verifyBody", { email: () => <bdi className="ltr-data font-medium text-text">{user.email}</bdi> })}
        icon={<IconBadge><MailCheck /></IconBadge>}
      />
      <div className="space-y-4">
        <DevMailNotice />
        <ResendVerificationButton />
        <SignOutButton />
      </div>
    </>
  );
}
