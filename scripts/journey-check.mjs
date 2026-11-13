import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const browser = await chromium.launch();
const errors = [], results = [];
const dir = 'screenshots/journey-after';
mkdirSync(dir, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  for (const locale of ['en', 'ur']) for (const theme of ['light', 'dark']) {
    await page.context().addCookies([{ name: 'NEXT_LOCALE', value: locale, url: 'http://localhost:3001' }, { name: 'expenvia_motion', value: 'system', url: 'http://localhost:3001' }]);
    await page.goto('http://localhost:3001');
    await page.evaluate(t => localStorage.setItem('expenvia-theme', t), theme);
    await page.reload();
    await page.waitForSelector('.journey-canvas[data-ready="true"]');
    for (const width of [320, 360, 390, 430, 768, 900, 1199, 1200, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(180);
      const geometry = await page.evaluate(() => {
        const bounds = document.querySelector('.journey-canvas').getBoundingClientRect();
        const anchors = [...document.querySelectorAll('.journey-anchor')].map(el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2 - bounds.x, y: r.y + r.height / 2 - bounds.y }; });
        const cards = [...document.querySelectorAll('.journey-card')].map(el => { const r = el.getBoundingClientRect(); return { x: r.x - bounds.x, y: r.y - bounds.y, w: r.width, h: r.height }; });
        const overlap = cards.some((a, i) => cards.some((b, j) => i < j && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y));
        const segments = [...document.querySelectorAll('.journey-segment')];
        const connected = segments.every((path, i) => [0, 1].every(end => { const p = path.getPointAtLength(end * path.getTotalLength()), a = anchors[i + end]; return Math.hypot(p.x - a.x, p.y - a.y) < 1; }));
        const crossesCard = segments.some(path => Array.from({ length: 51 }, (_, i) => path.getPointAtLength(path.getTotalLength() * i / 50)).some(p => cards.some(c => p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h)));
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1, overlap, connected, crossesCard, count: cards.length, textOverflow: [...document.querySelectorAll('.journey-card p,.journey-card h3')].some(el => el.scrollWidth > el.clientWidth + 1) };
      });
      assert.deepEqual(geometry, { overflow: false, overlap: false, connected: true, crossesCard: false, count: 4, textOverflow: false }, `${locale}/${theme}/${width}`);
      results.push(`${locale}/${theme}/${width}: geometry passed`);
    }
  }
  const progressState = () => page.evaluate(() => {
    const path = document.querySelector('.journey-path-progress');
    const progress = parseFloat(getComputedStyle(path).strokeDasharray);
    const particle = document.querySelector('.journey-particle');
    let error = 0;
    if (particle) { const matrix = new DOMMatrix(getComputedStyle(particle).transform), expected = path.getPointAtLength(path.getTotalLength() * progress); error = Math.hypot(matrix.e - expected.x, matrix.f - expected.y); }
    return { progress, reached: [...document.querySelectorAll('.journey-anchor')].map(el => el.dataset.reached === 'true'), particleError: error };
  });
  for (const locale of ['en', 'ur']) for (const width of [1440, 900, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.context().addCookies([{ name: 'NEXT_LOCALE', value: locale, url: 'http://localhost:3001' }]);
    await page.reload();
    await page.waitForSelector('.journey-path-progress');
    const extent = await page.locator('.journey-canvas').evaluate(el => ({ top: el.getBoundingClientRect().top + scrollY, height: el.offsetHeight }));
    let previous = -1;
    for (const p of [0, .2, .45, .75, 1]) {
      await page.evaluate(({ extent, p }) => window.scrollTo({ top: extent.top - innerHeight * .86 + p * (extent.height + innerHeight * .16), behavior: 'instant' }), { extent, p });
      await page.waitForTimeout(p === 0 || p === 1 ? 1600 : 750);
      const state = await progressState();
      assert.ok(Math.abs(state.progress - p) < .02, `${locale}/${width}: forward ${p}: ${JSON.stringify(state)}`);
      const count = state.reached.filter(Boolean).length;
      assert.ok(count >= previous);
      assert.deepEqual(state.reached, state.reached.map((_, i) => i < count));
      assert.ok(state.particleError < 2, `particle follows the actual curve: ${state.particleError}`);
      if (p === 0) assert.equal(count, 0, `${locale}/${width}: spring start ${JSON.stringify(state)}`);
      if (p === 1) assert.equal(count, 4, `${locale}/${width}: spring completion ${JSON.stringify(state)}`);
      previous = count;
    }
    for (const p of [.65, .3, 0]) {
      await page.evaluate(({ extent, p }) => window.scrollTo({ top: extent.top - innerHeight * .86 + p * (extent.height + innerHeight * .16), behavior: 'instant' }), { extent, p });
      await page.waitForTimeout(p === 0 ? 1600 : 750);
      const state = await progressState();
      assert.ok(Math.abs(state.progress - p) < .02);
      assert.ok(state.reached.filter(Boolean).length <= previous);
      previous = state.reached.filter(Boolean).length;
    }
    results.push(`${locale}/${width}: forward/reverse sequence and particle passed`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.journey-card').first().scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(800);
  const before = await progressState();
  await page.locator('.journey-card').first().hover();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.journey-card').first().getAttribute('data-selected'), 'true');
  assert.ok(Math.abs((await progressState()).progress - before.progress) < .01, 'hover does not change scroll progress');
  assert.ok(await page.locator('.journey-segment').first().evaluate(el => parseFloat(getComputedStyle(el).opacity) > .5));
  await page.mouse.move(0, 0);
  const button = page.locator('.journey-select').first();
  await button.focus();
  await page.waitForTimeout(350);
  assert.equal(await page.locator('.journey-card').first().getAttribute('data-selected'), 'true');
  assert.ok(await button.evaluate(el => getComputedStyle(el).outlineStyle !== 'none'));
  await page.keyboard.press('Enter');
  assert.equal(await button.getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await button.getAttribute('aria-pressed'), 'false');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.journey-select').nth(1).evaluate(el => el === document.activeElement), true);
  for (const preference of ['system', 'reduced']) {
    await page.evaluate(p => document.documentElement.dataset.motion = p, preference);
    await page.emulateMedia({ reducedMotion: preference === 'system' ? 'reduce' : 'no-preference' });
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.journey-particle').count(), 0);
    assert.equal((await progressState()).progress, 1);
    assert.equal((await progressState()).reached.filter(Boolean).length, 4);
    assert.ok(await page.locator('.journey-card').evaluateAll(els => els.every(el => new DOMMatrix(getComputedStyle(el).transform).m42 === 0)));
  }
  results.push('Hover, keyboard focus/Enter/Escape/Tab and both reduced-motion preferences passed');
  const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await touch.goto('http://localhost:3001');
  const tap = touch.locator('.journey-select').nth(1);
  await tap.tap();
  assert.equal(await tap.getAttribute('aria-pressed'), 'true');
  await tap.tap();
  assert.equal(await tap.getAttribute('aria-pressed'), 'false');
  await touch.close();
  results.push('Mobile tap selection passed');
  const staticPage = await browser.newPage({ javaScriptEnabled: false });
  for (const width of [1440, 900, 320]) {
    await staticPage.setViewportSize({ width, height: 1000 });
    await staticPage.goto('http://localhost:3001');
    assert.equal(await staticPage.locator('.journey-card:visible').count(), 4);
    assert.ok(await staticPage.locator('.journey-fallback:visible,.journey-fallback-mobile:visible').count() > 0);
    await staticPage.locator('#workflow').screenshot({ path: `${dir}/no-js-${width}.png`, caret: 'initial', style: '.marketing>header{display:none!important}' });
  }
  await staticPage.close();
  results.push('No-JavaScript cards and static paths passed at desktop/tablet/320px');
  assert.deepEqual(errors, []);
  writeFileSync(`${dir}/checks.json`, JSON.stringify({ results, errors }, null, 2));
  console.log(`${results.length} workflow verification groups passed; no browser errors.`);
} finally { await browser.close(); }
