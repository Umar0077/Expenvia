import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const stage = process.argv[2] || 'after';
const dir = `screenshots/contour-${stage}`;
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
let checks = 0;
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(60000);
  page.on('pageerror', e => errors.push(e.message));
  for (const locale of stage === 'before' ? ['en'] : ['en', 'ur']) {
    for (const theme of ['light', 'dark']) {
      await page.context().addCookies([{ name: 'NEXT_LOCALE', value: locale, url: 'http://localhost:3001' }]);
      await page.goto('http://localhost:3001');
      await page.evaluate(t => localStorage.setItem('expenvia-theme', t), theme);
      await page.reload();
      await page.locator('#capabilities').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1200);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.locator('#capabilities').scrollIntoViewIfNeeded();
        await page.waitForTimeout(700);
        await page.locator('#capabilities').screenshot({ path: `${dir}/${locale}-${theme}-${width}.png`, caret: 'initial', style: '.marketing>header{display:none!important}' });
      }
      if (stage === 'after') {
        for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920]) {
          await page.setViewportSize({ width, height: 1000 });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          assert.equal(await page.locator('.signature-contour').count(), 6);
          checks++;
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
  }
  if (stage === 'after') {
    const card = page.locator('.signature-contour').first();
    const state = () => card.evaluate(el => ({
      y: new DOMMatrix(getComputedStyle(el).transform).m42,
      width: el.offsetWidth, height: el.offsetHeight,
      iconY: new DOMMatrix(getComputedStyle(el.querySelector('.capability-icon')).transform).m42,
      highlight: getComputedStyle(el.querySelector('.signature-contour-face > path:last-child')).strokeDashoffset,
      shadow: getComputedStyle(el.querySelector('.signature-contour-face')).filter,
    }));
    await card.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(700);
    const rest = await state();
    await card.hover();
    await page.waitForTimeout(900);
    const hover = await state();
    assert.equal(rest.width, hover.width);
    assert.equal(rest.height, hover.height);
    assert.ok(hover.y < -3);
    assert.ok(hover.iconY < -1);
    assert.notEqual(rest.highlight, hover.highlight);
    assert.notEqual(rest.shadow, hover.shadow);
    await card.screenshot({ path: `${dir}/hover.png`, caret: 'initial' });
    // Check both OS preference and the in-app override; compare transforms so
    // Playwright's automatic scrolling cannot masquerade as an animation.
    for (const preference of ['system', 'reduced']) {
      await page.evaluate(value => document.documentElement.dataset.motion = value, preference);
      await page.emulateMedia({ reducedMotion: preference === 'system' ? 'reduce' : 'no-preference' });
      await page.mouse.move(0, 0);
      await page.waitForTimeout(700);
      await card.hover();
      await page.waitForTimeout(700);
      const reduced = await state();
      assert.equal(reduced.y, 0, `${preference}: card stays still`);
      assert.equal(reduced.iconY, 0, `${preference}: icon stays still`);
      assert.equal(parseFloat(reduced.highlight), 0, `${preference}: highlight stays still`);
    }
  }
  assert.deepEqual(errors, []);
  writeFileSync(`${dir}/checks.json`, JSON.stringify({ checks, errors }, null, 2));
  console.log(`${stage}: ${checks} responsive checks; screenshots and hover/reduced-motion checks complete`);
} finally {
  await browser.close();
}
