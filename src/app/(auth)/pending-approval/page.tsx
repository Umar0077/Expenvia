import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Hourglass } from "lucide-react";
import { AuthHeading, IconBadge } from "@/components/auth/auth-heading";
import { ApprovalTimeline } from "@/components/auth/approval-timeline";
import { RefreshStatusButton, SignOutButton } from "@/components/auth/status-actions";
import { Alert } from "@/components/ui/form";
import { dashboardFor, getSessionState, statusRoute } from "@/server/auth/session";
import { db } from "@/server/db";

export default async function PendingApprovalPage() {
  const state = await getSessionState();
  if (state.kind === "active") redirect(dashboardFor(state.actor.role));
  if (state.kind !== "inactive") redirect("/login");
  if (state.status !== "PENDING_APPROVAL" && state.status !== "INFO_REQUESTED") redirect(statusRoute(state.status));

  const t = await getTranslations("auth");
  const f = await getFormatter();
  const user = await db.user.findUniqueOrThrow({
    where: { id: state.userId },
    select: { emailVerifiedAt: true, registration: { select: { createdAt: true, publicMessage: true, status: true } } },
  });
  const reg = user.registration;
  const infoRequested = state.status === "INFO_REQUESTED";
  const fmt = (d?: Date | null) => (d ? f.dateTime(d, { dateStyle: "medium", timeStyle: "short" }) : undefined);

  return (
    <>
      <AuthHeading title={infoRequested ? t("infoRequestedTitle") : t("pendingTitle")} body={t("pendingBody")} icon={<IconBadge tone="warning"><Hourglass /></IconBadge>} />
      <div className="space-y-6">
        {reg?.publicMessage && (
          <Alert tone="info">
            <p className="font-medium">{t("messageFromAdmin")}</p>
            <p className="mt-1 whitespace-pre-line">{reg.publicMessage}</p>
          </Alert>
        )}
        <div className="surface-card p-5">
          <ApprovalTimeline
            current={2}
            stages={[
              { label: t("stageSubmitted"), meta: fmt(reg?.createdAt) },
              { label: t("stageVerified"), meta: fmt(user.emailVerifiedAt) },
              { label: t("stageReview") },
              { label: t("stageAccess") },
            ]}
          />
        </div>
        <RefreshStatusButton />
        <SignOutButton />
      </div>
    </>
  );
}
