import { intlLocale, type AppLocale } from "@/i18n/config";

type DecimalLike = string | number | { toString(): string };

/**
 * One money formatter for the whole app so amounts render identically on
 * every page. Uses Intl with decimal *strings* (no float conversion).
 */
export function formatMoney(amount: DecimalLike, currency: string, locale: AppLocale, opts: { compact?: boolean } = {}): string {
  const value = typeof amount === "number" ? amount : amount.toString();
  const nf = new Intl.NumberFormat(intlLocale[locale], {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: opts.compact ? 0 : 2,
    maximumFractionDigits: opts.compact ? 1 : 2,
    notation: opts.compact ? "compact" : "standard",
  });
  // Intl accepts numeric strings at full precision (ES2023 Intl.NumberFormat v3).
  return nf.format(value as unknown as number);
}

export function formatNumber(value: DecimalLike, locale: AppLocale, maxFractionDigits = 4): string {
  return new Intl.NumberFormat(intlLocale[locale], { maximumFractionDigits: maxFractionDigits }).format(value.toString() as unknown as number);
}

/** Fixed-precision amount without currency code (2 decimals; up to `max` for unit rates). */
export function formatAmount(value: DecimalLike, locale: AppLocale, max = 2): string {
  return new Intl.NumberFormat(intlLocale[locale], { minimumFractionDigits: 2, maximumFractionDigits: max }).format(value.toString() as unknown as number);
}

export function formatDate(d: Date, locale: AppLocale, style: "medium" | "short" | "long" = "medium"): string {
  return new Intl.DateTimeFormat(intlLocale[locale], { dateStyle: style, timeZone: "Asia/Karachi" }).format(d);
}

export function formatDateTime(d: Date, locale: AppLocale): string {
  return new Intl.DateTimeFormat(intlLocale[locale], { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(d);
}

/** Date-only DB values (@db.Date) are UTC midnight; format them in UTC so the day never shifts. */
export function formatDay(d: Date, locale: AppLocale): string {
  return new Intl.DateTimeFormat(intlLocale[locale], { dateStyle: "medium", timeZone: "UTC" }).format(d);
}

export function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}
