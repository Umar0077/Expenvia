import { chromium } from "playwright";
import { readdirSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Run email:preview first. Only synthetic templates are opened here.
const directory = resolve("storage/email/template-previews");
mkdirSync("screenshots", { recursive: true });
const browser = await chromium.launch();
let checks = 0;
try {
  const page = await browser.newPage();
  for (const width of [375, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const file of readdirSync(directory).filter(name => name.endsWith(".html"))) {
      await page.goto(pathToFileURL(resolve(directory, file)).href);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) {
        throw new Error(`Horizontal overflow: ${file} at ${width}px`);
      }
      if (file.startsWith("invoice_paymentRecorded-")) {
        await page.screenshot({ path: `screenshots/email-${width}-${file.replace(".html", ".png")}`, fullPage: true });
      }
      checks++;
    }
  }
  console.log(`${checks} synthetic email template viewport checks passed`);
} finally {
  await browser.close();
}
