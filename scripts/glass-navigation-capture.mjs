import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const stage=process.argv[2]||'before',dir=`screenshots/glass-navigation-${stage}`;
mkdirSync(dir,{recursive:true});
if(stage==='before'){
 copyFileSync('src/components/landing/executive-app-bar.tsx',`${dir}/executive-app-bar.tsx.bak`);
 const files=['src/app/page.tsx','src/components/landing/executive-landing.css','src/components/landing/hero-visual.tsx','src/components/landing/hero-entrance.tsx','src/app/urdu-typography.css','src/components/brand/logo.tsx','src/components/landing/workflow-journey.tsx','src/components/landing/workflow-journey.css','src/components/landing/signature-contour-card.tsx','src/components/landing/branch-network.tsx','src/components/ambient/ambient-background.tsx','src/components/preferences/language-switcher.tsx','src/components/preferences/theme-toggle.tsx'];
 writeFileSync(`${dir}/preserved.json`,JSON.stringify(Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')])),null,2));
}
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 for(const locale of ['en','ur'])for(const theme of ['light','dark']){
  await page.context().addCookies([{name:'NEXT_LOCALE',value:locale,url:'http://localhost:3001'},{name:'expenvia_motion',value:'system',url:'http://localhost:3001'}]);
  await page.goto('http://localhost:3001');await page.evaluate(t=>localStorage.setItem('expenvia-theme',t),theme);await page.reload();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1600);
  await page.screenshot({path:`${dir}/${locale}-${theme}-top.png`});await page.locator('.executive-bar').screenshot({path:`${dir}/${locale}-${theme}-bar.png`});
  await page.evaluate(()=>scrollTo(0,640));await page.waitForTimeout(850);await page.screenshot({path:`${dir}/${locale}-${theme}-scrolled.png`});
  await page.locator('.executive-links a').nth(1).hover();await page.waitForTimeout(600);await page.locator('.executive-bar').screenshot({path:`${dir}/${locale}-${theme}-hover.png`});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(500);
  await page.screenshot({path:`${dir}/${locale}-${theme}-mobile.png`});await page.locator('.executive-menu-trigger').click();await page.getByRole('dialog').waitFor();await page.waitForTimeout(350);await page.screenshot({path:`${dir}/${locale}-${theme}-mobile-menu.png`});await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.setViewportSize({width:1440,height:1000});await page.mouse.move(0,0);await page.evaluate(()=>scrollTo(0,0));
 }
 console.log(`Saved ${stage} glass navigation comparisons.`);
}finally{await browser.close();}
