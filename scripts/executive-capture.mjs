import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const stage = process.argv[2] || 'before', dir = `screenshots/executive-${stage}`;
mkdirSync(dir, { recursive: true });
if (stage === 'before') {
  for (const [file, name] of [['src/app/page.tsx','page.tsx.bak'],['src/components/landing/hero-visual.tsx','hero-visual.tsx.bak'],['src/app/landing-refinement.css','landing-refinement.css.bak']]) copyFileSync(file, `${dir}/${name}`);
  const files = ['src/components/brand/logo.tsx','src/app/urdu-typography.css','src/components/landing/signature-contour-card.tsx','src/components/landing/workflow-journey.tsx','src/components/landing/workflow-journey.css','src/components/landing/branch-network.tsx','src/components/ambient/ambient-background.tsx','src/app/atelier.css','src/components/preferences/language-switcher.tsx','src/components/preferences/theme-toggle.tsx'];
  writeFileSync(`${dir}/preserved.json`, JSON.stringify(Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')])),null,2));
}
const browser = await chromium.launch(); const measurements = [];
try {
  const page = await browser.newPage({ viewport: { width:1440,height:1000 } });
  for (const locale of ['en','ur']) for (const theme of ['light','dark']) {
    await page.context().addCookies([{name:'NEXT_LOCALE',value:locale,url:'http://localhost:3001'},{name:'expenvia_motion',value:'reduced',url:'http://localhost:3001'}]);
    await page.goto('http://localhost:3001'); await page.evaluate(t=>localStorage.setItem('expenvia-theme',t),theme); await page.reload();
    await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(2400);
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:width===390?844:1000}); await page.evaluate(()=>scrollTo(0,0)); await page.waitForTimeout(700);
      const dimensions=await page.evaluate(()=>({hero:document.querySelector('.landing-hero').getBoundingClientRect().height,header:document.querySelector('.marketing > header').getBoundingClientRect().height}));
      measurements.push({locale,theme,width,...dimensions});
      await page.screenshot({path:`${dir}/${locale}-${theme}-${width}.png`});
      await page.locator('.marketing > header').screenshot({path:`${dir}/${locale}-${theme}-${width}-header.png`});
      await page.locator('.landing-hero').screenshot({path:`${dir}/${locale}-${theme}-${width}-hero.png`,style:'.marketing>header{opacity:0!important}'});
    }
    await page.setViewportSize({width:1440,height:1000});
  }
  writeFileSync(`${dir}/measurements.json`,JSON.stringify(measurements,null,2));console.log(`Saved ${stage} screenshots and hero dimensions.`);
} finally { await browser.close(); }
