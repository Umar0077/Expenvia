import { chromium } from "playwright";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

// Creates accounts through the development-only form on the running local app.
const baseURL = "http://localhost:3001";
const suffix = Date.now().toString(36);
const password = `Demo-${randomBytes(6).toString("hex")}-7`;
const accounts = [
  { role: "Super Admin", name: "Demo Super Admin", email: `admin.${suffix}@expenvia.test`, path: "admin" },
  { role: "Employee", name: "Demo Employee", email: `user.${suffix}@expenvia.test`, path: "user" },
  { role: "Vendor", name: "Demo Vendor", email: `vendor.${suffix}@expenvia.test`, path: "vendor" },
];
const browser = await chromium.launch();
try {
  for (const account of accounts) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);
    await page.goto(`${baseURL}/dev-access`);
    await page.getByRole("radio", { name: new RegExp(`^${account.role}`) }).click();
    await page.getByLabel(/Full name/i).fill(account.name);
    await page.getByLabel(/Email address/i).fill(account.email);
    await page.getByLabel(/^Password/i).first().fill(password);
    await page.getByRole("button", { name: "Create account & sign in" }).click();
    await page.waitForURL(`**/${account.path}/dashboard`);
    // Check the saved credentials through the normal login form too.
    await context.clearCookies();
    await page.goto(`${baseURL}/login`);
    await page.getByLabel(/Email address/i).fill(account.email);
    await page.getByLabel(/^Password/i).first().fill(password);
    await page.getByRole("button", { name: /^Sign in$/ }).click();
    await page.waitForURL(`**/${account.path}/dashboard`);
    console.log(`${account.role}: ${account.email} — login verified`);
    writeFileSync(".local-demo-logins.txt", `Local demo login: ${baseURL}/login\nPassword: ${password}\n${accounts.map(a => `${a.role}: ${a.email}`).join("\n")}\n`);
    await context.close();
  }
  console.log(`Password: ${password}`);
} finally {
  await browser.close();
}
