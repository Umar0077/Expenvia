import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LockKeyhole } from "lucide-react";
import { AuthHeading, IconBadge } from "@/components/auth/auth-heading";
import { ResetForm } from "@/components/auth/auth-forms";
import { Alert } from "@/components/ui/form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <>
      <AuthHeading title={t("resetTitle")} body={t("resetBody")} icon={<IconBadge><LockKeyhole /></IconBadge>} />
      {token ? (
        <ResetForm token={token} />
      ) : (
        <div className="space-y-5">
          <Alert tone="danger">{t("resetInvalid")}</Alert>
          <Link href="/forgot-password" className="block text-center text-sm font-medium text-brand hover:underline">{t("forgotTitle")}</Link>
        </div>
      )}
    </>
  );
}
