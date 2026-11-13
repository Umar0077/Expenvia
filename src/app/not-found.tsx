import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";
import { StatusScreen } from "@/components/status-screen";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return <StatusScreen icon={Compass} title={t("notFoundTitle")} body={t("notFoundBody")} action={{ href: "/", label: t("goHome") }} />;
}
