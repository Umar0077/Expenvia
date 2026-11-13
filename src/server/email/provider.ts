import "server-only";
import nodemailer from "nodemailer";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { emailConfig, safeAddress } from "./config";

export interface EmailMessage { id: string; to: string; subject: string; text: string; html: string }
export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<{ preview: boolean; reference: string }>;
  close?(): void;
}
export class DeliveryError extends Error {
  constructor(public category: string, public temporary: boolean) { super(category); }
}
export function classifyError(error: unknown): DeliveryError {
  if (error instanceof DeliveryError) return error;
  const e = error as { code?: string; responseCode?: number };
  if (e.code === "EAUTH") return new DeliveryError("AUTHENTICATION", false);
  if (e.responseCode && e.responseCode >= 500) return new DeliveryError("RECIPIENT_OR_POLICY", false);
  if (["ETIMEDOUT", "ESOCKET", "ECONNECTION", "ECONNRESET", "ECONNREFUSED", "EDNS"].includes(e.code ?? "") || (e.responseCode && e.responseCode >= 400)) return new DeliveryError("TEMPORARY_TRANSPORT", true);
  return new DeliveryError("TRANSPORT_FAILURE", true);
}
export function createEmailProvider(): EmailProvider {
  const config = emailConfig();
  if (config.provider === "development") return {
    name: "development",
    async send(message) {
      const dir = resolve(process.env.STORAGE_DIR || "storage", "email", "previews");
      await mkdir(dir, { recursive: true, mode: 0o700 });
      // Local private files, never served by the website or included in logs.
      await writeFile(resolve(dir, `${message.id}.html`), message.html, { mode: 0o600 });
      await writeFile(resolve(dir, `${message.id}.txt`), message.text, { mode: 0o600 });
      console.info(`[email:preview] ${message.id} saved locally; NOT delivered`);
      return { preview: true, reference: message.id };
    },
  };
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: config.port, secure: config.secure,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
    requireTLS: true, tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000,
    disableFileAccess: true, disableUrlAccess: true,
    logger: false, debug: false,
  });
  return {
    name: "smtp",
    async send(message) {
      safeAddress(message.to);
      if (/[\r\n]/.test(message.subject)) throw new DeliveryError("INVALID_HEADER", false);
      const result = await transport.sendMail({
        from: { name: config.fromName, address: config.fromAddress }, to: message.to,
        subject: message.subject, html: message.html, text: message.text,
        messageId: `<${message.id}@${config.fromAddress.split("@")[1]}>`,
      });
      if (!result.accepted?.length) throw new DeliveryError("RECIPIENT_REJECTED", false);
      return { preview: false, reference: result.messageId };
    },
    close: () => transport.close(),
  };
}
