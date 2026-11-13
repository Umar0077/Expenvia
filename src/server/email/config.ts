import "server-only";
import { z } from "zod";

export function safeAddress(value: string): string {
  if (/[\r\n]/.test(value)) throw new Error("INVALID_EMAIL_ADDRESS");
  return z.email().max(254).parse(value);
}

export function publicUrl(path = "/"): string {
  const configured = process.env.APP_PUBLIC_URL || process.env.APP_URL;
  if (!configured && process.env.NODE_ENV === "production") throw new Error("APP_PUBLIC_URL_REQUIRED");
  const base = new URL(configured || "http://localhost:3000");
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash ||
      (process.env.NODE_ENV === "production" && base.protocol !== "https:")) throw new Error("INVALID_APP_PUBLIC_URL");
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\r\n]/.test(path)) throw new Error("INVALID_EMAIL_LINK");
  const result = new URL(path, base.origin);
  if (result.origin !== base.origin) throw new Error("INVALID_EMAIL_LINK");
  return result.toString();
}

export function emailConfig() {
  publicUrl();
  const provider = process.env.EMAIL_PROVIDER?.trim() || "development";
  if (provider !== "smtp" && provider !== "development") throw new Error("INVALID_EMAIL_PROVIDER");
  if (process.env.NODE_ENV === "production" && provider !== "smtp") throw new Error("SMTP_REQUIRED_IN_PRODUCTION");
  const fromName = process.env.EMAIL_FROM_NAME || "Expenvia";
  if (/[\r\n]/.test(fromName)) throw new Error("INVALID_FROM_NAME");
  const fromAddress = safeAddress(process.env.EMAIL_FROM_ADDRESS || (provider === "development" ? "preview@expenvia.test" : ""));
  const port = z.coerce.number().int().min(1).max(65535).parse(process.env.SMTP_PORT || "587");
  const secure = z.enum(["true", "false"]).parse(process.env.SMTP_SECURE || "false") === "true";
  if (provider === "smtp" && (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD)) throw new Error("SMTP_CONFIGURATION_REQUIRED");
  return { provider, fromName, fromAddress, port, secure };
}
