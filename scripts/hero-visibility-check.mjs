import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const dir='screenshots/executive-hero-after', results=[], errors=[];
for(const [file,hash] of Object.entries(JSON.parse(readFileSync('screenshots/executive-hero-before/preserved.json','utf8'))))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,`${file}: unchanged`);
const browser=await chromium.launch();
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  for(const locale of ['en','ur'])for(const theme of ['light','dark']){
    await page.context().addCookies([{name:'NEXT_LOCALE',value:locale,url:'http://localhost:3001'},{name:'expenvia_motion',value:'reduced',url:'http://localhost:3001'}]);
    await page.goto('http://localhost:3001');await page.evaluate(t=>localStorage.setItem('expenvia-theme',t),theme);await page.reload();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);
    for(const width of [320,360,390,430,768,1024,1280,1440,1920]){
      await page.setViewportSize({width,height:1000});await page.waitForTimeout(120);
      const state=await page.evaluate(()=>{
        const heading=document.querySelector('.hero-headline'),style=getComputedStyle(heading),preview=document.querySelector('.executive-preview'),chart=document.querySelector('.executive-preview-chart'),panel=document.querySelector('.executive-preview-main');
        const rect=el=>el.getBoundingClientRect();const h=rect(heading),p=rect(preview),c=rect(chart),m=rect(panel);
        return{overflow:document.documentElement.scrollWidth>innerWidth+1,fontSize:parseFloat(style.fontSize),fontWeight:style.fontWeight,clipped:[...document.querySelectorAll('.hero-headline,.executive-preview-label,.executive-preview-value,.executive-hero-actions a')].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.textContent),lineCounts:[...heading.children].map(el=>Math.round(el.getBoundingClientRect().height/parseFloat(style.lineHeight))),columnsOverlap:h.left<p.right&&h.right>p.left&&h.top<p.bottom&&h.bottom>p.top,chartContained:c.bottom<=m.bottom&&c.left>=m.left&&c.right<=m.right,previewOpacity:getComputedStyle(panel).opacity,panelBackground:getComputedStyle(panel).backgroundColor,bars:[...document.querySelectorAll('.executive-preview-bar')].map(el=>getComputedStyle(el).opacity)};
      });
      assert.equal(state.overflow,false,`${locale}/${theme}/${width}`);assert.deepEqual(state.clipped,[]);assert.equal(state.columnsOverlap,false);assert.ok(state.chartContained);assert.equal(state.previewOpacity,'1');assert.ok(state.bars.every(value=>value==='1'));
      if(locale==='en'){assert.equal(state.fontWeight,'700');assert.deepEqual(state.lineCounts,[1,1,1],`${width}: three balanced English lines`);}
      results.push({locale,theme,width,...state});
    }
  }
  await page.setViewportSize({width:1440,height:1000});await page.context().addCookies([{name:'NEXT_LOCALE',value:'en',url:'http://localhost:3001'},{name:'expenvia_motion',value:'system',url:'http://localhost:3001'}]);await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addInitScript(()=>{
    window.__heroOpacity=[];const start=performance.now();const sample=()=>{const nodes=[document.querySelector('.hero-headline')?.parentElement,...document.querySelectorAll('.executive-preview-main,.executive-preview-invoice,.executive-preview-branch,.executive-preview-pending')].filter(Boolean);if(nodes.length===5)window.__heroOpacity.push(nodes.map(el=>Number(getComputedStyle(el).opacity)));if(performance.now()-start<6000)requestAnimationFrame(sample);};requestAnimationFrame(sample);
  });
  await page.goto('http://localhost:3001');await page.waitForTimeout(2000);const samples=await page.evaluate(()=>window.__heroOpacity);assert.ok(samples.length>10);assert.ok(samples.every(row=>row.every(value=>value===1)),'Heading and all preview panels stay fully opaque during entrance');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(250);assert.equal(await page.locator('.executive-float').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.deepEqual(errors,[]);writeFileSync(`${dir}/checks.json`,JSON.stringify({results,opacitySamples:samples.length,minimumEntranceOpacity:Math.min(...samples.flat()),errors},null,2));console.log(`${results.length} responsive checks passed; ${samples.length} entrance samples stayed fully opaque; reduced motion and preserved-file checks passed.`);
}finally{await browser.close();}
