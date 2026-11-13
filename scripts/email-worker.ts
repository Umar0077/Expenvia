import "dotenv/config";
import { db } from "../src/server/db";
import { createEmailProvider } from "../src/server/email/provider";
import { encryptionKey } from "../src/server/email/crypto";
import { claimEmail, processEmail } from "../src/server/email/worker";

let stopping = false;
let wake: (() => void) | undefined;
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { stopping = true; wake?.(); });
async function main() {
  encryptionKey();
  const provider = createEmailProvider();
  console.info(`[email:worker] ${provider.name}; ${provider.name === "development" ? "private previews only, no delivery" : "SMTP acceptance tracking"}`);
  // Audit only non-secret configuration changes, never credentials or provider errors.
  const fingerprint = JSON.stringify({ provider: provider.name, from: process.env.EMAIL_FROM_ADDRESS ?? "preview@expenvia.test", url: process.env.APP_PUBLIC_URL ?? process.env.APP_URL ?? "local" });
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(120012)`;
    const previous = await tx.systemSetting.findUnique({ where: { key: "email.configFingerprint" } });
    if (previous?.value !== fingerprint) {
      await tx.systemSetting.upsert({ where: { key: "email.configFingerprint" }, create: { key: "email.configFingerprint", value: fingerprint }, update: { value: fingerprint } });
      await tx.auditLog.create({ data: { action: "email.configuration_changed", entityType: "system_setting", entityId: "email", summary: { provider: provider.name } } });
    }
  });
  try {
    while (!stopping) {
      try {
        const claim = await claimEmail();
        if (claim) { await processEmail(claim, provider); continue; }
      } catch { console.error("[email:worker] processing failed; job will recover after its lease expires"); }
      if (process.argv.includes("--once")) break;
      await new Promise<void>(resolve => { const timer = setTimeout(resolve, 2000); wake = () => { clearTimeout(timer); resolve(); }; });
    }
  } finally { provider.close?.(); await db.$disconnect(); }
}
main().catch(() => { console.error("[email:worker] startup failed; check configuration and database access (secrets omitted)"); process.exitCode = 1; db.$disconnect(); });
