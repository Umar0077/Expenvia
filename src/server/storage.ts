import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "@/server/errors";

/**
 * Private file storage (outside /public). Files are addressed only by a
 * generated key; the original filename is metadata. Content type is decided
 * by magic bytes, never by the client-supplied MIME type or extension.
 * Swap `writeObject`/`readObject` for S3/Azure/GCS in production.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: "application/pdf", ext: "pdf", test: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
];

function root() {
  return path.resolve(process.env.STORAGE_DIR ?? "./storage");
}

export interface StoredFile {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  // keep letters (any script), digits, dot, dash, underscore, space
  const clean = base.replace(/[^\p{L}\p{N}._\- ]/gu, "_").replace(/\s+/g, " ").trim();
  return (clean || "file").slice(0, 120);
}

export async function storeUpload(file: File, namespace: "receipts" | "invoices" | "payments" | "avatars"): Promise<StoredFile> {
  if (file.size === 0) throw new DomainError("fileType");
  if (file.size > MAX_UPLOAD_BYTES) throw new DomainError("fileSize");
  const buf = Buffer.from(await file.arrayBuffer());
  const sig = SIGNATURES.find((s) => s.test(buf));
  if (!sig) throw new DomainError("fileType");

  const storageKey = `${namespace}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${sig.ext}`;
  const full = path.join(root(), storageKey);
  if (!full.startsWith(root() + path.sep)) throw new DomainError("fileType");
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf, { flag: "wx" });
  return {
    storageKey,
    fileName: sanitizeFileName(file.name),
    mimeType: sig.mime,
    sizeBytes: buf.length,
    sha256: createHash("sha256").update(buf).digest("hex"),
  };
}

export async function readObject(storageKey: string): Promise<Buffer> {
  const full = path.resolve(root(), storageKey);
  if (!full.startsWith(root() + path.sep)) throw new DomainError("notFound");
  return readFile(full);
}
