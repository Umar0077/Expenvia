import { expect, test } from "./fixtures";

test("test accounts can enter Super Admin and sign in again", async ({ page }) => {
  const email = `quick-access-${Date.now()}@demo.expenvia.test`;
  const password = "Test-access-123";
  await page.goto("/signup");
  await page.getByRole("link", { name: /Create a test account/ }).click();
  await expect(page).toHaveURL(/\/dev-access$/, { timeout: 30_000 });
  await page.getByLabel(/Full name/i).fill("Quick Access Test");
  await page.getByLabel(/Email address/i).fill(email);
  await page.getByLabel(/^Password/i).first().fill(password);
  await page.getByRole("button", { name: "Create account & sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Executive overview" })).toBeVisible();
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/Email address/i).fill(email);
  await page.getByLabel(/^Password/i).first().fill(password);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/, { timeout: 30_000 });
});
