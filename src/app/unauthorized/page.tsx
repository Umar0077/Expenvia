import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { StatusScreen } from "@/components/status-screen";
import { dashboardFor, getSessionState } from "@/server/auth/session";

export default async function UnauthorizedPage() {
  const t = await getTranslations("errors");
  const state = await getSessionState();
  const action = state.kind === "active" ? { href: dashboardFor(state.actor.role), label: t("goToDashboard") } : { href: "/", label: t("goHome") };
  return <StatusScreen icon={ShieldAlert} tone="warning" title={t("unauthorizedTitle")} body={t("unauthorizedBody")} action={action} />;
}
