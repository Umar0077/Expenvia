import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";

test("admin navigation and filters do not produce React errors", async ({ page }) => {
  test.setTimeout(180_000);
  const local = process.env.E2E_BASE_URL?.includes(":3001");
  const credentials = readFileSync(local ? ".local-demo-logins.txt" : ".demo-credentials.txt", "utf8");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.stack ?? error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/login");
  await page.getByLabel(/Email address/i).fill(local ? /Super Admin: (\S+)/.exec(credentials)![1]! : "ceo@demo.expenvia.test");
  await page.getByLabel(/^Password/i).first().fill((local ? /Password: (\S+)/ : /Password for every demo account: (\S+)/).exec(credentials)![1]!);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/, { timeout: 30_000 });
  await page.route("**/*", async route => {
    if (route.request().headers()["rsc"] === "1") await new Promise(resolve => setTimeout(resolve, 400));
    await route.continue();
  });
  for (const path of ["users", "dashboard", "vendors", "dashboard", "reports", "dashboard"]) {
    await page.locator(`aside nav a[href="/admin/${path}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/admin/${path}$`), { timeout: 30_000 });
    await expect(page.locator("main h1")).toBeVisible({ timeout: 30_000 });
  }
  for (let i = 0; i < 3; i++) {
    await page.goBack();
    await expect(page.locator("main h1")).toBeVisible();
    await page.goForward();
    await expect(page.locator("main h1")).toBeVisible();
  }
  await page.reload();
  await expect(page.locator("main h1")).toBeVisible();
  const period = page.getByRole("combobox").first();
  const values = await period.locator("option").evaluateAll(options => options.map(o => (o as HTMLOptionElement).value).filter(Boolean));
  for (const value of values.slice(0, 3)) {
    await period.selectOption(value);
    await expect(page).toHaveURL(new RegExp(`period=${value}`));
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 });
  }
  expect(errors).toEqual([]);
});
