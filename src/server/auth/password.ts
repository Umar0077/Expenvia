import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id (algorithm 2) — OWASP-recommended parameters (19 MiB, t=2, p=1).
const OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Used when the email does not exist, so failed logins take similar time either way.
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword("expenvia-timing-equalizer");
  await verifyPassword(await dummyHash, password);
}
