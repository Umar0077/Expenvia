import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const dir = 'screenshots/aurora-rollback';
mkdirSync(dir, { recursive: true });
const preserved = JSON.parse(readFileSync(`${dir}/source-backup/preserved-hashes.json`, 'utf8'));
for (const [file, hash] of Object.entries(preserved)) assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), hash, `Preserved file: ${file}`);
const browser = await chromium.launch();
const results = [], errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  for (const locale of ['en', 'ur']) for (const theme of ['light', 'dark']) {
    await page.context().addCookies([{ name: 'NEXT_LOCALE', value: locale, url: 'http://localhost:3001' }, { name: 'expenvia_motion', value: 'reduced', url: 'http://localhost:3001' }]);
    await page.goto('http://localhost:3001');
    await page.evaluate(t => localStorage.setItem('expenvia-theme', t), theme);
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(2300);
    assert.equal(await page.locator('.living-aurora,.living-page,.living-ribbons,.preview-dashboard').count(), 0);
    assert.equal(await page.locator('.landing-hero > .fluid-aurora[data-variant="hero"]').count(), 1);
    assert.equal(await page.locator('main > section:last-child .fluid-aurora[data-variant="auth"]').count(), 1);
    assert.equal(await page.locator('.signature-contour').count(), 6);
    assert.equal(await page.locator('.journey-card').count(), 4);
    for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(200);
      const state = await page.evaluate(() => {
        const hero = document.querySelector('.landing-hero');
        const heading = hero.querySelector('h1');
        const panel = hero.querySelector('.surface-card');
        const h = hero.getBoundingClientRect(), title = heading.getBoundingClientRect(), p = panel.getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1, headingContained: title.left >= h.left - 1 && title.right <= h.right + 1 && title.bottom <= h.bottom, previewContained: p.left >= h.left - 1 && p.right <= h.right + 1 && p.bottom <= h.bottom, logoWidth: document.querySelector('.brand-logo-navigation').getBoundingClientRect().width, backgroundPosition: getComputedStyle(hero.querySelector('.fluid-aurora')).position, captionSize: getComputedStyle(document.documentElement).getPropertyValue('--type-caption').trim() };
      });
      assert.equal(state.overflow, false, `${locale}/${theme}/${width}`);
      assert.ok(state.headingContained && state.previewContained, `${locale}/${theme}/${width}: hero visibility`);
      assert.equal(state.backgroundPosition, 'absolute');
      assert.ok(state.logoWidth >= 122 && state.logoWidth <= 166);
      if (locale === 'ur') assert.equal(state.captionSize, '15px');
      results.push({ locale, theme, width, ...state });
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(2300);
      await page.screenshot({ path: `${dir}/${locale}-${theme}-${width}-final.png` });
      await page.locator('.landing-hero').screenshot({ path: `${dir}/${locale}-${theme}-${width}-hero.png`, style: '.marketing > header{visibility:hidden!important}' });
    }
  }
  assert.deepEqual(errors, []);
  writeFileSync(`${dir}/checks.json`, JSON.stringify({ preservedFiles: Object.keys(preserved), results, errors }, null, 2));
  console.log(`${results.length} responsive/theme/language checks passed; ${Object.keys(preserved).length} protected files unchanged; no browser errors.`);
} finally { await browser.close(); }
