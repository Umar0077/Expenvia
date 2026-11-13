import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FlaskConical } from "lucide-react";
import { AuthHeading, IconBadge } from "@/components/auth/auth-heading";
import { DevAccessForm } from "@/components/auth/dev-access-form";
import { Alert } from "@/components/ui/form";
import { devAccessEnabled } from "@/server/dev-access";

/** Development-only page. Returns 404 unless ALLOW_DEV_ACCOUNTS=true outside production. */
export default async function DevAccessPage() {
  if (!devAccessEnabled()) notFound();
  const t = await getTranslations("devAccess");
  const ta = await getTranslations("auth");
  return (
    <div className="py-4">
      <AuthHeading title={t("title")} body={t("body")} icon={<IconBadge tone="warning"><FlaskConical /></IconBadge>} />
      <Alert tone="warning" className="mb-5">{t("warning")}</Alert>
      <DevAccessForm />
      <p className="mt-5 rounded-[var(--radius-md)] border border-border bg-surface-2/60 p-4 text-sm text-muted">{t("adminHelp")}</p>
      <p className="mt-5 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-brand hover:underline">{ta("backToSignIn")}</Link>
      </p>
    </div>
  );
}
