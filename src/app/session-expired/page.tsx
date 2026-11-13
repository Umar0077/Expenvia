import { getTranslations } from "next-intl/server";
import { TimerOff } from "lucide-react";
import { StatusScreen } from "@/components/status-screen";

export default async function SessionExpiredPage() {
  const t = await getTranslations("errors");
  const tl = await getTranslations("landing");
  return <StatusScreen icon={TimerOff} title={t("sessionExpiredTitle")} body={t("sessionExpiredBody")} action={{ href: "/login", label: tl("signIn") }} />;
}
