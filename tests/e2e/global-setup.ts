import "dotenv/config";
import pg from "pg";

/** Clears login rate-limit buckets on the DEMO database so repeated E2E runs don't lock accounts. */
export default async function globalSetup() {
  const url = process.env.DEMO_DATABASE_URL;
  if (!url || !/demo/.test(new URL(url).pathname)) throw new Error("E2E requires DEMO_DATABASE_URL pointing at the demo database");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("DELETE FROM rate_limit_buckets");
  await client.end();
}
