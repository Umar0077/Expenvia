import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const stage = process.argv[2] || 'before';
const folder = `screenshots/journey-${stage}`;
mkdirSync(folder, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const locale of ['en', 'ur']) for (const theme of ['light', 'dark']) for (const width of [1440, 900, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.context().addCookies([{ name: 'NEXT_LOCALE', value: locale, url: 'http://localhost:3001' }, { name: 'expenvia_motion', value: 'reduced', url: 'http://localhost:3001' }]);
    await page.goto('http://localhost:3001');
    await page.evaluate(t => localStorage.setItem('expenvia-theme', t), theme);
    await page.reload();
    await page.locator('#workflow').scrollIntoViewIfNeeded();
    await page.waitForTimeout(750);
    await page.locator('#workflow').screenshot({ path: `${folder}/${locale}-${theme}-${width}.png`, caret: 'initial', style: '.marketing>header{display:none!important}' });
  }
  console.log(`Captured 12 ${stage} workflow screenshots.`);
} finally { await browser.close(); }
