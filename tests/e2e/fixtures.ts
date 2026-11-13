import "dotenv/config";
import { test as base, expect } from "@playwright/test";
import pg from "pg";

// Browser cases share seeded demo accounts. Reset only demo rate-limit buckets
// between serial cases; actual rate-limit behavior is integration-tested separately.
export const test = base.extend<{ demoRateLimits: void }>({
  demoRateLimits: [async ({}, use) => {
    const url = process.env.DEMO_DATABASE_URL;
    if (!url || !/demo/.test(new URL(url).pathname)) throw new Error("Demo database required");
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try { await client.query("DELETE FROM rate_limit_buckets"); } finally { await client.end(); }
    await use();
  }, { auto: true }],
});
export { expect };
