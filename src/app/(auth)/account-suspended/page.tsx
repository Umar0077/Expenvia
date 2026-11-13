import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldOff } from "lucide-react";
import { AuthHeading, IconBadge } from "@/components/auth/auth-heading";
import { SignOutButton } from "@/components/auth/status-actions";
import { getSessionState, statusRoute } from "@/server/auth/session";

export default async function AccountSuspendedPage() {
  const state = await getSessionState();
  if (state.kind !== "inactive") redirect("/login");
  if (state.status !== "SUSPENDED") redirect(statusRoute(state.status));
  const t = await getTranslations("auth");
  return (
    <>
      <AuthHeading title={t("suspendedTitle")} body={t("suspendedBody")} icon={<IconBadge tone="danger"><ShieldOff /></IconBadge>} />
      <SignOutButton />
    </>
  );
}
