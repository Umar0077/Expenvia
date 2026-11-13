import "server-only";

/**
 * Development quick access is available ONLY when:
 *   NODE_ENV !== "production"  AND  ALLOW_DEV_ACCOUNTS === "true"
 * It bypasses registration review on purpose (for local exploration), so it
 * must never be reachable in production.
 */
export function devAccessEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_ACCOUNTS === "true";
}
