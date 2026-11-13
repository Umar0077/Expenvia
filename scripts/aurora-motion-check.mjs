import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
const dir='screenshots/aurora-after';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch();const errors=[];const report={};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.context().addCookies([{name:'NEXT_LOCALE',value:'en',url:'http://localhost:3001'},{name:'expenvia_motion',value:'system',url:'http://localhost:3001'}]);
 await page.goto('http://localhost:3001');await page.waitForTimeout(2000);
 const read=()=>page.evaluate(()=>({ribbon:getComputedStyle(document.querySelector('.living-ribbon-primary')).transform,depth:getComputedStyle(document.querySelector('.living-ribbons')).transform,scroll:getComputedStyle(document.querySelector('.living-scroll-layer')).transform,float:getComputedStyle(document.querySelector('.preview-invoice')).transform}));
 const initial=await read();await page.waitForTimeout(1200);const flowing=await read();assert.notEqual(initial.ribbon,flowing.ribbon);assert.notEqual(initial.float,flowing.float);
 await page.mouse.move(110,160);await page.waitForTimeout(700);const left=await read();await page.mouse.move(1320,740);await page.waitForTimeout(700);const right=await read();assert.notEqual(left.depth,right.depth);
 await page.locator('#capabilities').scrollIntoViewIfNeeded();await page.waitForTimeout(1300);const scrolled=await read();assert.notEqual(scrolled.scroll,right.scroll);
 assert.equal(await page.locator('.living-aurora').count(),1);assert.equal(await page.locator('.marketing .fluid-aurora').count(),0);
 assert.equal(await page.locator('.preview-invoice').evaluate(el=>getComputedStyle(el).animationPlayState),'paused');
 assert.equal(await page.locator('.living-aurora').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 assert.equal(await page.locator('.living-aurora').evaluate(el=>Math.round(el.getBoundingClientRect().top)),0);
 report.motion='Continuous ribbons, floating invoice, spring pointer depth, scroll atmosphere, one persistent canvas and offscreen preview pause passed';
 for(const pref of ['system','reduced']){
  await page.evaluate(p=>document.documentElement.dataset.motion=p,pref);await page.emulateMedia({reducedMotion:pref==='system'?'reduce':'no-preference'});await page.waitForTimeout(600);
  assert.equal(await page.locator('.living-ribbon-primary').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(await page.locator('.preview-invoice').evaluate(el=>getComputedStyle(el).animationName),'none');
  const a=await read();await page.mouse.move(50,50);await page.waitForTimeout(300);await page.mouse.move(1300,900);await page.waitForTimeout(300);const b=await read();assert.equal(a.depth,b.depth);assert.equal(a.ribbon,b.ribbon);
 }
 report.reduced='OS and in-app reduced motion retain the full canvas and stop ambient, floating and pointer movement';
 await page.evaluate(()=>document.documentElement.dataset.motion='system');await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(1500);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
 const before=await cdp.send('Performance.getMetrics');
 const sampling=page.evaluate(()=>new Promise(resolve=>{const intervals=[];let last=performance.now();const start=last;function frame(now){intervals.push(now-last);last=now;if(now-start<5000)requestAnimationFrame(frame);else{intervals.sort((a,b)=>a-b);resolve({samples:intervals.length,medianMs:intervals[Math.floor(intervals.length*.5)],p95Ms:intervals[Math.floor(intervals.length*.95)]});}}requestAnimationFrame(frame);}));
 for(let i=0;i<8;i++){await page.mouse.move(150+i*130,180+(i%3)*150);await page.mouse.wheel(0,i<4?80:-80);await page.waitForTimeout(350);}
 const frames=await sampling;const after=await cdp.send('Performance.getMetrics');const metric=(r,name)=>r.metrics.find(m=>m.name===name)?.value;
 report.profile={...frames,layoutCount:metric(after,'LayoutCount')-metric(before,'LayoutCount'),recalcStyleCount:metric(after,'RecalcStyleCount')-metric(before,'RecalcStyleCount'),scriptSeconds:metric(after,'ScriptDuration')-metric(before,'ScriptDuration'),taskSeconds:metric(after,'TaskDuration')-metric(before,'TaskDuration'),context:'5 seconds in local Chromium development build with pointer and scroll input; not an FPS guarantee'};
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(1200);await cdp.send('HeapProfiler.collectGarbage');const listenersBefore=await cdp.send('Memory.getDOMCounters');
 for(let i=0;i<3;i++){await page.locator('.hero-actions a[href="/signup"]').click();await page.waitForURL('**/signup');assert.equal(await page.locator('.living-aurora').count(),0);await page.getByRole('link',{name:'Expenvia',exact:true}).first().click();await page.waitForURL('http://localhost:3001/');await page.waitForTimeout(1100);}
 await cdp.send('HeapProfiler.collectGarbage');const listenersAfter=await cdp.send('Memory.getDOMCounters');report.navigation={listenersBefore,listenersAfter};
 assert.ok(listenersAfter.jsEventListeners<listenersBefore.jsEventListeners+100,'no growing batch of animation listeners after three client navigation cycles');
 const touch=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await touch.goto('http://localhost:3001');await touch.waitForTimeout(1200);assert.equal(await touch.locator('.living-ribbon-secondary').evaluate(el=>getComputedStyle(el).animationName),'none');assert.equal(await touch.locator('.living-light').evaluate(el=>getComputedStyle(el).animationName),'none');report.touch='Secondary ribbon and light drift disabled on mobile';await touch.close();
 assert.deepEqual(errors,[]);report.errors=errors;writeFileSync(`${dir}/motion-profile.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
