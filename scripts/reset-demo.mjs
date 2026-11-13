// Drops and recreates the DEMO database schema, then reseeds fictional data.
// Refuses unless the target database name contains "demo".
import "dotenv/config";
import { execSync } from "node:child_process";

const url = process.env.DEMO_DATABASE_URL;
if (!url || !/\/[^/?]*demo[^/?]*(\?|$)/.test(url)) {
  console.error("✖ DEMO_DATABASE_URL must be set and its database name must contain 'demo'.");
  process.exit(1);
}
const env = { ...process.env, DATABASE_URL: url, ALLOW_DEMO_SEED: "true" };
execSync("npx prisma migrate reset --force --skip-seed", { stdio: "inherit", env });
execSync("npx tsx scripts/seed-demo.ts", { stdio: "inherit", env });
