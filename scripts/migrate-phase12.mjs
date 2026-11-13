import "dotenv/config";
import { spawnSync } from "node:child_process";
import pg from "pg";

// Non-destructive deploy to configured local databases, with record-count checks.
for (const [name, url] of Object.entries({ application:process.env.DATABASE_URL, demo:process.env.DEMO_DATABASE_URL, test:process.env.TEST_DATABASE_URL })) {
  if (!url) continue;
  if (!["localhost","127.0.0.1"].includes(new URL(url).hostname)) throw new Error("This helper only migrates local databases");
  const client = new pg.Client({connectionString:url});
  await client.connect();
  try {
    const counts = async () => (await client.query("SELECT (SELECT count(*) FROM users)::text AS users, (SELECT count(*) FROM expenses)::text AS expenses, (SELECT count(*) FROM invoices)::text AS invoices, (SELECT count(*) FROM invoice_payments)::text AS payments")).rows[0];
    const before = await counts();
    const result = spawnSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{stdio:"inherit",env:{...process.env,DATABASE_URL:url}});
    if (result.status !== 0) throw new Error(`Migration failed: ${name}`);
    const after = await counts();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`Record counts changed: ${name}`);
    console.log(`${name}: migration applied; users/expenses/invoices/payments preserved`,after);
  } finally { await client.end(); }
}
