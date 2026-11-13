// Starts the dev server against the isolated DEMO database (DEMO_DATABASE_URL),
// leaving the regular DATABASE_URL untouched. Usage: npm run dev:demo
import "dotenv/config";
import { spawn } from "node:child_process";

const url = process.env.DEMO_DATABASE_URL ?? process.env.DATABASE_URL?.replace(/\/expenvia(\?|$)/, "/expenvia_demo$1");
if (!url) {
  console.error("Set DEMO_DATABASE_URL");
  process.exit(1);
}
const port = process.env.PORT ?? process.argv[2] ?? "3000";
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", port], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url, PORT: port },
});
child.on("exit", (code) => process.exit(code ?? 0));
