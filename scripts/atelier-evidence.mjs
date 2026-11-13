import "dotenv/config";
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import pg from "pg";
const stage = process.argv[2] || "before";
const base = "http://localhost:3002";
const credentials = readFileSync(".demo-credentials.txt", "utf8");
const password = /Password for every demo account: (\S+)/.exec(credentials)[1];
const employee = /Employee:\s+(\S+)/.exec(credentials)[1];
const vendor = /Vendor:\s+(\S+)/.exec(credentials)[1];
const db = new pg.Client({ connectionString: process.env.DEMO_DATABASE_URL });
if (!/demo/.test(new URL(process.env.DEMO_DATABASE_URL).pathname)) throw new Error("Demo only");
await db.connect();
await db.query("DELETE FROM rate_limit_buckets");
await db.end();
mkdirSync(`screenshots/atelier-${stage}`, { recursive: true });
const browser = await chromium.launch();
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
 page.setDefaultTimeout(60000);
 async function capture(name, path, theme="light", width=1440, locale="en") {
   await page.context().addCookies([{name:"NEXT_LOCALE",value:locale,url:base}]);
   await page.setViewportSize({ width, height:1000 });
   await page.goto(base+path); await page.evaluate(t=>localStorage.setItem("expenvia-theme",t),theme);await page.reload();
   await page.locator("h1").first().waitFor();await page.waitForTimeout(1200);
   for(let y=0;y<await page.evaluate(()=>document.documentElement.scrollHeight);y+=700){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(90);}
   await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(600);
   await page.screenshot({path:`screenshots/atelier-${stage}/${name}.png`,fullPage:true,caret:"initial"});
 }
 async function login(email) {
   await page.context().clearCookies();await page.goto(base+"/login");
   await page.getByLabel(/Email address/i).fill(email);await page.getByLabel(/^Password/i).first().fill(password);
   await page.getByRole("button",{name:/^Sign in$/}).click();await page.waitForURL(/\/(admin|user|vendor)\/dashboard/);
 }
 for(const theme of ["light","dark"]) await capture(`landing-${theme}`,"/",theme);
 await login("ceo@demo.expenvia.test");
 for(const theme of ["light","dark"]) {
   await capture(`admin-${theme}`,"/admin/dashboard",theme);
   await capture(`branches-${theme}`,"/admin/branches",theme);
 }
 await capture("invoices","/admin/invoices");
 await capture("mobile","/admin/dashboard","light",390);
 await capture("urdu","/admin/dashboard","dark",1440,"ur");
 await login(employee);await capture("employee","/user/dashboard");
 await login(vendor);await capture("vendor","/vendor/dashboard");
 console.log(`Captured 11 ${stage} views`);
} finally {await browser.close();}
