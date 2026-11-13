import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { UserX } from "lucide-react";
import { AuthHeading, IconBadge } from "@/components/auth/auth-heading";
import { SignOutButton } from "@/components/auth/status-actions";
import { Alert } from "@/components/ui/form";
import { getSessionState, statusRoute } from "@/server/auth/session";
import { db } from "@/server/db";

export default async function RegistrationRejectedPage() {
  const state = await getSessionState();
  if (state.kind !== "inactive") redirect("/login");
  if (state.status !== "REJECTED") redirect(statusRoute(state.status));
  const t = await getTranslations("auth");
  // Only the intentionally public message is shown — never the internal review note.
  const reg = await db.registrationRequest.findUnique({ where: { userId: state.userId }, select: { publicMessage: true } });
  return (
    <>
      <AuthHeading title={t("rejectedTitle")} body={t("rejectedBody")} icon={<IconBadge tone="danger"><UserX /></IconBadge>} />
      <div className="space-y-5">
        {reg?.publicMessage && (
          <Alert tone="info">
            <p className="font-medium">{t("messageFromAdmin")}</p>
            <p className="mt-1 whitespace-pre-line">{reg.publicMessage}</p>
          </Alert>
        )}
        <SignOutButton />
      </div>
    </>
  );
}
