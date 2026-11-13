// Scans representative pages at every target width, in English (LTR) and Urdu (RTL),
// and reports horizontal page overflow and elements wider than the viewport.
// Usage: node scripts/overflow-scan.mjs [baseUrl]
import { readFileSync } from "node:fs";
import pg from "pg";
import "dotenv/config";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3002";
const WIDTHS = [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920];
const creds = readFileSync(".demo-credentials.txt", "utf8");
const password = /Password for every demo account: (\S+)/.exec(creds)[1];
const emp = /Employee:\s+(\S+)/.exec(creds)[1];
const vendor = /Vendor:\s+(\S+)/.exec(creds)[1];
const db = new pg.Client({ connectionString: process.env.DEMO_DATABASE_URL });
await db.connect();
await db.query("DELETE FROM rate_limit_buckets");
await db.end();

const ROLES = [
  { email: null, pages: ["/", "/login", "/signup"] },
  { email: "ceo@demo.expenvia.test", pages: ["/admin/dashboard", "/admin/approvals", "/admin/invoices", "/admin/reports?type=branch", "/admin/branches", "/admin/audit-logs", "/admin/settings"] },
  { email: emp, pages: ["/user/dashboard", "/user/expenses", "/user/expenses/new"] },
  { email: vendor, pages: ["/vendor/dashboard", "/vendor/invoices/new", "/vendor/supplies"] },
];

const browser = await chromium.launch();
let problems = 0;
for (const locale of ["en", "ur"]) {
  for (const role of ROLES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    await ctx.addCookies([{ name: "NEXT_LOCALE", value: locale, url: base }]);
    const page = await ctx.newPage();
    if (role.email) {
      await page.goto(`${base}/login`);
      await page.locator('input[type="email"]').fill(role.email);
      await page.locator('input[autocomplete="current-password"]').fill(password);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(/dashboard/, { timeout: 60000 });
    }
    for (const path of role.pages) {
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto(`${base}${path}`, { waitUntil: "load" });
        await page.waitForTimeout(250);
        const r = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const over = document.documentElement.scrollWidth - vw;
          const culprits = [];
          if (over > 1) {
            for (const el of document.querySelectorAll("body *")) {
              const b = el.getBoundingClientRect();
              if (b.width > 0 && (b.right > vw + 1 || b.left < -1) && !el.closest("[aria-hidden],.ambient,.sr-only,[data-overflow-ok]")) {
                culprits.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")} [${Math.round(b.left)}→${Math.round(b.right)}]`);
                if (culprits.length >= 3) break;
              }
            }
          }
          return { over, culprits };
        });
        if (r.over > 1) {
          problems++;
          console.log(`OVERFLOW ${locale} ${w}px ${path}: +${r.over}px  ${r.culprits.join(" | ")}`);
        }
      }
    }
    await ctx.close();
  }
}
await browser.close();
console.log(problems ? `${problems} overflow case(s)` : "No horizontal overflow at any width (EN + UR).");
