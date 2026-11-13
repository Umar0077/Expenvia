import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests run against an isolated database (never the dev/demo DB).
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://expenvia:expenvia_dev_only@localhost:5433/expenvia_test?schema=public";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside React Server bundles; it's a no-op in tests.
      "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/integration/**/*.test.ts"],
    environment: "node",
    env: { DATABASE_URL: TEST_DATABASE_URL },
    fileParallelism: false,
    testTimeout: 20000,
  },
});
