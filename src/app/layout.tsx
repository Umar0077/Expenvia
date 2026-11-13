import type { Metadata, Viewport } from "next";
import { Inter, Noto_Naskh_Arabic, Noto_Nastaliq_Urdu } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Providers } from "@/components/providers";
import { localeDirection, type AppLocale } from "@/i18n/config";
import { MOTION_COOKIE, parseMotion } from "@/lib/preferences";
import "./globals.css";
import "./atelier.css";
import "./urdu-typography.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const naskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-urdu-ui",
  display: "swap",
  preload: false,
});
const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "600"],
  variable: "--font-nastaliq",
  display: "swap",
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: t("title"), template: "%s · Expenvia" },
    description: t("description"),
    applicationName: "Expenvia",
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF9F6" },
    { media: "(prefers-color-scheme: dark)", color: "#171F1C" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as AppLocale;
  const motion = parseMotion((await cookies()).get(MOTION_COOKIE)?.value);

  return (
    <html
      lang={locale}
      dir={localeDirection[locale]}
      data-motion={motion}
      suppressHydrationWarning
      className={`${inter.variable} ${naskh.variable} ${nastaliq.variable}`}
    >
      <body>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
