import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isAppLocale, LOCALE_COOKIE, type AppLocale } from "./config";

// Messages are split by feature area: messages/<locale>.json (core) + messages/<locale>/<area>.json
const AREAS = ["auth", "validation", "admin", "app", "org", "finance", "invoice", "reports", "email"] as const;

async function loadMessages(locale: AppLocale) {
  const core = (await import(`../../messages/${locale}.json`)).default;
  const parts = await Promise.all(AREAS.map((a) => import(`../../messages/${locale}/${a}.json`).then((m) => m.default)));
  return Object.assign({}, core, ...parts);
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale = isAppLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: "Asia/Karachi",
  };
});
