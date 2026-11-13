import "server-only";
import { db } from "@/server/db";

/**
 * Fixed-window rate limiter backed by Postgres (works across server instances
 * without extra infrastructure). Atomic via a single upsert statement.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limit_buckets (key, count, window_ends)
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limit_buckets.window_ends < now() THEN 1 ELSE rate_limit_buckets.count + 1 END,
      window_ends = CASE WHEN rate_limit_buckets.window_ends < now()
                         THEN now() + make_interval(secs => ${windowSeconds})
                         ELSE rate_limit_buckets.window_ends END
    RETURNING count`;
  return (rows[0]?.count ?? 0) <= limit;
}
