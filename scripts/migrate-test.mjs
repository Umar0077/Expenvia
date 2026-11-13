// Applies migrations to the isolated TEST database used by integration tests.
import "dotenv/config";
import { execSync } from "node:child_process";

const url = process.env.TEST_DATABASE_URL ?? "postgresql://expenvia:expenvia_dev_only@localhost:5433/expenvia_test?schema=public";
if (!/test/.test(new URL(url).pathname)) {
  console.error("✖ TEST_DATABASE_URL must point to a database whose name contains 'test'.");
  process.exit(1);
}
execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
