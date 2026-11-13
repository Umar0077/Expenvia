// Localization strategy: cookie-based locale, no URL prefix.
// URLs stay stable (/admin/dashboard) regardless of language; the preference
// is stored in the NEXT_LOCALE cookie and mirrored to user_preferences.
export const locales = ["en", "ur"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const localeDirection: Record<AppLocale, "ltr" | "rtl"> = {
  en: "ltr",
  ur: "rtl",
};

// Intl locale tags used for number/date formatting. Urdu keeps Latin digits
// (common practice in Pakistani finance documents) to avoid misreading amounts.
export const intlLocale: Record<AppLocale, string> = {
  en: "en-PK",
  ur: "ur-PK-u-nu-latn",
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
