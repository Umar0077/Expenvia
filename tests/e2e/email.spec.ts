import "dotenv/config";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import pg from "pg";

const credentials=readFileSync(".demo-credentials.txt","utf8");
const password=/Password for every demo account: (\S+)/.exec(credentials)![1]!;
const employee=/Employee:\s+(\S+)/.exec(credentials)![1]!;
async function login(page:Page,email="ceo@demo.expenvia.test") {
  await page.context().clearCookies();await page.goto("/login");
  await page.getByLabel(/Email address/i).fill(email);await page.getByLabel(/^Password/i).first().fill(password);
  await page.getByRole("button",{name:/^Sign in$/}).click();await page.waitForURL(/\/(admin|user)\/dashboard/,{timeout:60000});
}
test("email verification and reset use private development previews",async({page})=>{
  test.setTimeout(180000);
  const email=`email-e2e-${Date.now()}@demo.expenvia.test`;
  await page.goto("/signup");await page.getByLabel(/Full name/).fill("Email Preview Test");await page.getByLabel(/Email address/).fill(email);
  await page.getByLabel(/^Password/).first().fill("Email-Test-12345");await page.getByLabel(/Confirm password/).fill("Email-Test-12345");
  await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Submit request"}).click();
  await expect(page.getByText(/If this address is eligible/)).toBeVisible({timeout:30000});
  const client=new pg.Client({connectionString:process.env.DEMO_DATABASE_URL});await client.connect();
  const drain=()=>execFileSync(process.execPath,["--conditions=react-server","--import","tsx","scripts/email-worker.ts","--once"],{env:{...process.env,DATABASE_URL:process.env.DEMO_DATABASE_URL!,EMAIL_PROVIDER:"development",NODE_ENV:"development",APP_PUBLIC_URL:"http://localhost:3002"},stdio:"pipe",timeout:60000});
  try {
    drain();
    const row=(await client.query("SELECT id,status,payload FROM email_outbox WHERE recipient=$1 AND event_type='verification'",[email])).rows[0];
    expect(row.status).toBe("PREVIEWED");expect(row.payload).toBeNull();
    const preview=readFileSync(`storage/email/previews/${row.id}.txt`,"utf8");
    const link=/http:\/\/localhost:3002\/verify-email\?token=[A-Za-z0-9_-]+/.exec(preview)![0];
    await page.goto(link);await page.getByRole("button",{name:"Verify my email"}).click();await expect(page.getByText(/Email verified/)).toBeVisible();
    expect((await client.query("SELECT status FROM users WHERE email=$1",[email])).rows[0].status).toBe("PENDING_APPROVAL");
    await page.goto("/forgot-password");await page.getByLabel(/Email address/).fill(email);await page.getByRole("button",{name:"Send reset link"}).click();await expect(page.getByText(/If an account exists/)).toBeVisible();
    drain();
    const reset=(await client.query("SELECT id FROM email_outbox WHERE recipient=$1 AND event_type='password_reset'",[email])).rows[0];
    const resetText=readFileSync(`storage/email/previews/${reset.id}.txt`,"utf8");
    await page.goto(/http:\/\/localhost:3002\/reset-password\?token=[A-Za-z0-9_-]+/.exec(resetText)![0]);
    await page.getByLabel(/New password/).fill("Changed-Password-567");await page.getByLabel(/Confirm password/).fill("Changed-Password-567");
    await page.getByRole("button",{name:"Update password"}).click();await expect(page.getByText(/Your password has been updated/)).toBeVisible();
  } finally { await client.end(); }
});

test("@mobile email center supports light, dark, Urdu RTL and protected metadata",async({page,context},testInfo)=>{
  test.setTimeout(180000);await login(page);
  await page.goto("/admin/email-delivery");await expect(page.getByRole("heading",{name:"Email delivery",exact:true})).toBeVisible({timeout:30000});
  await expect(page.locator("main")).not.toContainText(/token=|SMTP_PASSWORD|EMAIL_ENCRYPTION_KEY/);
  for(const theme of ["light","dark"]) {
    await page.evaluate(value=>localStorage.setItem("expenvia-theme",value),theme);await page.reload();
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    await page.screenshot({path:`screenshots/phase12-${testInfo.project.name}-${theme}.png`,fullPage:true});
  }
  await context.addCookies([{name:"NEXT_LOCALE",value:"ur",url:"http://localhost:3002"}]);await page.reload();
  await expect(page.locator("html")).toHaveAttribute("dir","rtl");await expect(page.getByRole("heading",{name:"ای میل کی ترسیل",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:`screenshots/phase12-${testInfo.project.name}-ur-dark.png`,fullPage:true});
  await login(page,employee);await page.goto("/admin/email-delivery");await expect(page).toHaveURL(/\/unauthorized$/);
});

test("email preferences persist with the existing settings toggles",async({page})=>{
  await login(page,employee);await page.goto("/user/settings");
  const toggle=page.getByRole("switch",{name:/^Expense emails/});await expect(toggle).toBeVisible({timeout:30000});
  const before=await toggle.getAttribute("aria-checked");await toggle.click();await expect(toggle).toHaveAttribute("aria-checked",before==="true"?"false":"true");
  await expect(page.getByText(/Preferences saved|Preference saved|Saved/i).last()).toBeVisible();
  await page.reload();await expect(toggle).toHaveAttribute("aria-checked",before==="true"?"false":"true");await toggle.click();
});
