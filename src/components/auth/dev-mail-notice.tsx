import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/form";
import { isMailConfigured } from "@/server/mail";

/** Honest notice: shown only in development when no email provider is configured. */
export async function DevMailNotice() {
  if (isMailConfigured() || process.env.NODE_ENV === "production") return null;
  const t = await getTranslations("auth");
  return <Alert tone="warning">{t("devMailNotice")}</Alert>;
}
