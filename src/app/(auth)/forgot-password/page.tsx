import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { KeyRound } from "lucide-react";
import { AuthHeading, IconBadge } from "@/components/auth/auth-heading";
import { ForgotForm } from "@/components/auth/auth-forms";
import { DevMailNotice } from "@/components/auth/dev-mail-notice";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <>
      <AuthHeading title={t("forgotTitle")} body={t("forgotBody")} icon={<IconBadge><KeyRound /></IconBadge>} />
      <div className="space-y-5">
        <DevMailNotice />
        <ForgotForm />
        <p className="text-center text-sm">
          <Link href="/login" className="font-medium text-brand hover:underline">{t("backToSignIn")}</Link>
        </p>
      </div>
    </>
  );
}
