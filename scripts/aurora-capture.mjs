import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const stage = process.argv[2] || 'before', dir = `screenshots/aurora-${stage}`;
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  for (const locale of ['en', 'ur']) for (const theme of ['light', 'dark']) {
    await page.context().addCookies([{ name: 'NEXT_LOCALE', value: locale, url: 'http://localhost:3001' }, { name: 'expenvia_motion', value: 'reduced', url: 'http://localhost:3001' }]);
    await page.goto('http://localhost:3001');
    await page.evaluate(t => localStorage.setItem('expenvia-theme', t), theme);
    await page.reload();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${dir}/${locale}-${theme}-landing.png`, caret: 'initial' });
    if (locale === 'en') for (const selector of ['.landing-hero', '#workflow', '#capabilities', '#branches', '#security', 'main>section:last-child']) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      await page.locator(selector).screenshot({ path: `${dir}/${theme}-${selector.replace(/[^a-z]/g, '')}.png`, caret: 'initial', style: '.marketing>header{display:none!important}' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/${locale}-${theme}-mobile-nav.png`, caret: 'initial' });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  const credentials = readFileSync('.demo-credentials.txt', 'utf8');
  const password = /Password for every demo account: (\S+)/.exec(credentials)[1];
  await page.context().clearCookies();
  await page.context().addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: 'http://localhost:3002' }]);
  await page.goto('http://localhost:3002/login');
  await page.getByLabel(/Email address/i).fill('ceo@demo.expenvia.test');
  await page.getByLabel(/^Password/i).first().fill(password);
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await page.waitForURL('**/admin/dashboard');
  for (const locale of ['en', 'ur']) for (const theme of ['light', 'dark']) {
    await page.context().addCookies([{ name: 'NEXT_LOCALE', value: locale, url: 'http://localhost:3002' }, { name: 'expenvia_motion', value: 'reduced', url: 'http://localhost:3002' }]);
    await page.evaluate(t => localStorage.setItem('expenvia-theme', t), theme);
    await page.reload();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${dir}/${locale}-${theme}-dashboard.png`, caret: 'initial' });
  }
  console.log(`Saved ${stage} landing sections, navigation and dashboard screenshots.`);
} finally { await browser.close(); }
