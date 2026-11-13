import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

let localKey: Buffer | undefined;
export function encryptionKey(): Buffer {
  const configured = process.env.EMAIL_ENCRYPTION_KEY;
  if (configured) {
    if (!/^[a-fA-F0-9]{64}$/.test(configured)) throw new Error("EMAIL_ENCRYPTION_KEY_MUST_BE_32_BYTES_HEX");
    return Buffer.from(configured, "hex");
  }
  if (process.env.NODE_ENV === "production") throw new Error("EMAIL_ENCRYPTION_KEY_REQUIRED");
  if (localKey) return localKey;
  // One private local key shared by web and worker. Never log it or put it in /public.
  const dir = resolve(process.env.STORAGE_DIR || "storage", "email");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = resolve(dir, ".key");
  try { writeFileSync(file, randomBytes(32), { flag: "wx", mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  const key = readFileSync(file);
  if (key.length !== 32) throw new Error("INVALID_LOCAL_EMAIL_KEY");
  localKey = key;
  return key;
}

export function encryptPayload(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}
export function decryptPayload(value: string): unknown {
  const data = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"));
}
