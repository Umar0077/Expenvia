import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/primitives";
import { AppearancePicker, LanguagePicker, MotionToggles, NotificationPrefs, PasswordForm, ProfileForm, Section, SessionList, SystemSettingsForm } from "@/components/account/settings-sections";
import { db } from "@/server/db";
import type { Actor } from "@/server/auth/session";
import { MOTION_COOKIE, parseMotion } from "@/lib/preferences";
import { formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

function describeAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return [browser, os].filter(Boolean).join(" · ");
}

export async function SettingsView({ actor }: { actor: Actor }) {
  const t = await getTranslations("settings");
  const locale = (await getLocale()) as AppLocale;
  const motion = parseMotion((await cookies()).get(MOTION_COOKIE)?.value);
  const [user, prefs, sessions, org] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { fullName: true, phone: true, email: true } }),
    db.userPreference.findUnique({ where: { userId: actor.userId } }),
    db.session.findMany({ where: { userId: actor.userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" }, take: 10 }),
    actor.role === "SUPER_ADMIN" ? db.systemSetting.findUnique({ where: { key: "orgName" } }) : null,
  ]);
  const show = actor.role === "USER" ? (["notifyExpenseUpdates", "notifyAccountUpdates"] as const) : actor.role === "VENDOR" ? (["notifyInvoiceUpdates", "notifyAccountUpdates"] as const) : (["notifyExpenseUpdates", "notifyInvoiceUpdates", "notifyAccountUpdates"] as const);

  return (
    <div className="max-w-6xl">
      <PageHeader title={t("title")} description={t("description")} />
      <div className="space-y-5">
        <Section title={t("profile")} body={t("profileBody")}><ProfileForm fullName={user.fullName} phone={user.phone ?? ""} email={user.email} /></Section>
        <Section title={t("appearance")} body={t("appearanceBody")}><AppearancePicker /></Section>
        <Section title={t("language")} body={t("languageBody")}><LanguagePicker /></Section>
        <Section title={t("motion")} body={t("motionBody")}><MotionToggles initial={motion} /></Section>
        <Section title={t("notifications")} body={t("notificationsBody")}>
          <NotificationPrefs
            show={[...show, ...(actor.role !== "VENDOR" ? ["emailExpenseUpdates" as const] : []), ...(actor.role !== "USER" ? ["emailInvoiceUpdates" as const] : []), "emailBranchUpdates", "emailActivityUpdates"]}
            prefs={{
              notifyExpenseUpdates: prefs?.notifyExpenseUpdates ?? true,
              notifyInvoiceUpdates: prefs?.notifyInvoiceUpdates ?? true,
              notifyAccountUpdates: prefs?.notifyAccountUpdates ?? true,
              emailExpenseUpdates: prefs?.emailExpenseUpdates ?? true,
              emailInvoiceUpdates: prefs?.emailInvoiceUpdates ?? true,
              emailBranchUpdates: prefs?.emailBranchUpdates ?? true,
              emailActivityUpdates: prefs?.emailActivityUpdates ?? true,
            }}
          />
        </Section>
        <Section title={t("security")} body={t("securityBody")}>
          <div className="space-y-8">
            <PasswordForm />
            <div>
              <h3 className="mb-3 text-sm font-semibold">{t("sessions")}</h3>
              <SessionList sessions={sessions.map((s) => ({ id: s.id, current: s.id === actor.sessionId, agent: describeAgent(s.userAgent), lastSeen: formatDateTime(s.lastSeenAt, locale) }))} />
            </div>
          </div>
        </Section>
        {actor.role === "SUPER_ADMIN" && (
          <Section title={t("system.title")} body={t("system.body")}><SystemSettingsForm orgName={typeof org?.value === "string" ? org.value : ""} /></Section>
        )}
      </div>
    </div>
  );
}
