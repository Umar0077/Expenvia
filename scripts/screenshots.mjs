// Captures representative screens (demo env) for visual review.
// Usage: node scripts/screenshots.mjs <outDir> [baseUrl]
import { mkdirSync, readFileSync } from "node:fs";
import pg from "pg";
import "dotenv/config";
import { chromium } from "playwright";

const out = process.argv[2] ?? "screenshots";
const base = process.argv[3] ?? "http://localhost:3002";
mkdirSync(out, { recursive: true });
const creds = readFileSync(".demo-credentials.txt", "utf8");
const password = /Password for every demo account: (\S+)/.exec(creds)[1];
const emp = /Employee:\s+(\S+)/.exec(creds)[1];
const vendor = /Vendor:\s+(\S+)/.exec(creds)[1];

// Clear login rate limits on the demo DB so repeated runs don't lock accounts.
const db = new pg.Client({ connectionString: process.env.DEMO_DATABASE_URL });
await db.connect();
await db.query("DELETE FROM rate_limit_buckets");
const inv = (await db.query("SELECT id FROM invoices WHERE status='PARTIALLY_PAID' ORDER BY grand_total DESC LIMIT 1")).rows[0]?.id;
await db.end();

const browser = await chromium.launch();
async function shoot({ name, email, path, width = 1440, height = 900, theme = "light", locale = "en", full = false }) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion: "reduce" });
  await ctx.addCookies([{ name: "NEXT_LOCALE", value: locale, url: base }]);
  await ctx.addInitScript((t) => localStorage.setItem("expenvia-theme", t), theme);
  const page = await ctx.newPage();
  if (email) {
    await page.goto(`${base}/login`);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[autocomplete="current-password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/dashboard/, { timeout: 60000 });
  }
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) console.log(`OVERFLOW ${name}: ${overflow}px`);
  await ctx.close();
}

const shots = [
  { name: "landing-light", path: "/", full: true },
  { name: "landing-dark-ur", path: "/", theme: "dark", locale: "ur" },
  { name: "login-light", path: "/login" },
  { name: "admin-dashboard-light", email: "ceo@demo.expenvia.test", path: "/admin/dashboard", full: true },
  { name: "admin-dashboard-dark", email: "ceo@demo.expenvia.test", path: "/admin/dashboard", theme: "dark" },
  { name: "admin-approvals", email: "ceo@demo.expenvia.test", path: "/admin/approvals" },
  { name: "admin-reports", email: "ceo@demo.expenvia.test", path: "/admin/reports?type=branch" },
  ...(inv ? [{ name: "admin-invoice", email: "ceo@demo.expenvia.test", path: `/admin/invoices/${inv}` }] : []),
  { name: "admin-settings-ur-dark", email: "ceo@demo.expenvia.test", path: "/admin/settings", theme: "dark", locale: "ur" },
  { name: "user-dashboard", email: emp, path: "/user/dashboard" },
  { name: "user-new-expense", email: emp, path: "/user/expenses/new" },
  { name: "vendor-dashboard", email: vendor, path: "/vendor/dashboard" },
  { name: "vendor-invoice-builder", email: vendor, path: "/vendor/invoices/new" },
  { name: "mobile-360-admin-dashboard", email: "ceo@demo.expenvia.test", path: "/admin/dashboard", width: 360, height: 780 },
  { name: "mobile-390-ur-user", email: emp, path: "/user/dashboard", width: 390, height: 844, locale: "ur" },
  { name: "tablet-768-vendor", email: vendor, path: "/vendor/dashboard", width: 768, height: 1024, theme: "dark" },
];
const only = process.argv[4]?.split(",");
for (const s of shots) if (!only || only.includes(s.name)) await shoot(s);
await browser.close();
console.log("done", out);
