import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir='screenshots/glass-navigation-after',results=[],errors=[];
const protectedFiles=JSON.parse(readFileSync('screenshots/glass-navigation-before/preserved.json','utf8'));
for(const [file,hash] of Object.entries(protectedFiles))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,`${file} preserved`);
const translations=Object.fromEntries(['en','ur'].map(locale=>[locale,JSON.parse(readFileSync(`messages/${locale}.json`,'utf8'))]));
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const measure=()=>page.evaluate(()=>{
  const bar=document.querySelector('.executive-bar'),r=bar.getBoundingClientRect(),style=getComputedStyle(bar);
  const controls=[...bar.querySelectorAll('a,button')].filter(el=>el.getBoundingClientRect().width>0);
  const clipped=controls.filter(el=>{const c=el.getBoundingClientRect();return c.left<r.left-1||c.right>r.right+1||c.top<r.top-1||c.bottom>r.bottom+1;}).map(el=>el.textContent||el.getAttribute('aria-label'));
  const overlap=controls.some((el,i)=>controls.slice(i+1).some(other=>{const a=el.getBoundingClientRect(),b=other.getBoundingClientRect();return a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;}));
  const nav=document.querySelector('.executive-links').getBoundingClientRect();
  return{height:r.height,headerHeight:document.querySelector('.executive-header').getBoundingClientRect().height,heroTop:document.querySelector('.landing-hero').getBoundingClientRect().top+scrollY,overflow:document.documentElement.scrollWidth>innerWidth+1,clipped,overlap,logo:bar.querySelector('.brand-logo-navigation').getBoundingClientRect().width,blur:style.backdropFilter,fill:parseFloat(bar.style.getPropertyValue('--glass-fill')),navOffset:nav.width?Math.abs((nav.left+nav.width/2)-(r.left+r.width/2)):null};
 });
 for(const locale of ['en','ur'])for(const theme of ['light','dark']){
  await page.context().addCookies([{name:'NEXT_LOCALE',value:locale,url:'http://localhost:3001'},{name:'expenvia_motion',value:'system',url:'http://localhost:3001'}]);await page.goto('http://localhost:3001');await page.evaluate(t=>localStorage.setItem('expenvia-theme',t),theme);await page.reload();await page.evaluate(()=>document.fonts.ready);
  for(const width of [320,360,390,430,768,1024,1280,1440,1920]){
   await page.setViewportSize({width,height:1000});await page.mouse.move(0,0);await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(650);const top=await measure();assert.equal(top.overflow,false);assert.deepEqual(top.clipped,[],`${locale}/${theme}/${width} controls`);assert.equal(top.overlap,false,`${locale}/${width} overlap`);assert.ok(top.logo>=122);if(width>=1280)assert.ok(top.navOffset<1,'Centered link capsule');
   await page.evaluate(()=>scrollTo(0,400));await page.waitForTimeout(650);const scrolled=await measure();assert.ok(Math.abs(top.height-scrolled.height-8)<.25,`${width}: 8px compression`);assert.equal(top.headerHeight,scrolled.headerHeight);assert.ok(Math.abs(top.heroTop-scrolled.heroTop)<1,'No hero layout shift');assert.equal(top.blur,scrolled.blur,'Blur remains static');assert.ok(scrolled.fill>top.fill);assert.deepEqual(scrolled.clipped,[]);assert.equal(scrolled.overlap,false);
   if(width<1280){
    const trigger=page.getByRole('button',{name:translations[locale].nav.openMenu,exact:true});await trigger.click();const dialog=page.getByRole('dialog');await dialog.waitFor();await page.waitForTimeout(350);
    assert.equal(await dialog.evaluate(el=>getComputedStyle(el).direction),locale==='ur'?'rtl':'ltr');assert.ok(await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight;}));
    for(const key of ['navFeatures','navWorkflow','navSecurity','signIn','getStarted'])assert.ok(await dialog.getByRole('link',{name:translations[locale].landing[key],exact:true}).isVisible());assert.ok(await dialog.getByRole('radiogroup').isVisible());
    if(width===320)await page.screenshot({path:`${dir}/${locale}-${theme}-320-menu.png`});
    const scrollBefore=await page.evaluate(()=>scrollY);await page.mouse.move(2,700);await page.mouse.wheel(0,300);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>scrollY),scrollBefore,'Modal locks page scroll');
    for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)),'Focus remains inside dialog');}
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement===document.querySelector('.executive-menu-trigger'));
   }
   results.push({locale,theme,width,top,scrolled});
  }
 }
 // Section state remains authoritative while temporary mouse/focus highlights move.
 await page.context().addCookies([{name:'NEXT_LOCALE',value:'en',url:'http://localhost:3001'}]);await page.setViewportSize({width:1440,height:1000});await page.goto('http://localhost:3001');await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(()=>scrollTo(0,document.getElementById('workflow').offsetTop-innerHeight*.24));await page.waitForTimeout(600);
 const links=page.locator('.executive-links a'),workflow=links.filter({hasText:'Workflow'}),security=links.filter({hasText:'Security'});
 assert.equal(await workflow.getAttribute('aria-current'),'location');await security.hover();await page.waitForTimeout(250);assert.equal(await security.getAttribute('data-highlighted'),'true');assert.equal(await workflow.getAttribute('aria-current'),'location');assert.equal(await security.getAttribute('aria-current'),null);
 for(const index of [0,2,1,2,0,1]){await links.nth(index).hover();await page.waitForTimeout(40);}await page.mouse.move(0,500);await page.waitForTimeout(400);assert.equal(await workflow.getAttribute('data-highlighted'),'true');assert.equal(await page.locator('.glass-link-highlight').count(),1);
 await security.focus();await page.waitForTimeout(300);assert.equal(await security.getAttribute('data-highlighted'),'true');assert.ok(await security.evaluate(el=>getComputedStyle(el).outlineStyle!=='none'));assert.equal(await workflow.getAttribute('aria-current'),'location');
 await page.keyboard.press('Enter');await page.waitForTimeout(650);assert.ok(page.url().endsWith('#security'));assert.equal(await security.getAttribute('aria-current'),'location');
 // Pointer lighting follows a fine pointer and fades on exit.
 const bar=await page.locator('.executive-bar').boundingBox();await page.mouse.move(bar.x+220,bar.y+30);await page.waitForTimeout(400);const light1=await page.locator('.glass-pointer').evaluate(el=>({background:getComputedStyle(el).backgroundImage,opacity:parseFloat(getComputedStyle(el).opacity)}));await page.mouse.move(bar.x+850,bar.y+30);await page.waitForTimeout(400);const light2=await page.locator('.glass-pointer').evaluate(el=>getComputedStyle(el).backgroundImage);assert.ok(light1.opacity>.5);assert.notEqual(light1.background,light2);await page.mouse.move(0,600);await page.waitForTimeout(600);assert.ok(await page.locator('.glass-pointer').evaluate(el=>parseFloat(getComputedStyle(el).opacity)<.01));
 // CTA, logo and account links retain destinations; logo uses original artwork.
 assert.equal(await page.locator('.executive-access').getAttribute('href'),'/signup');assert.equal(await page.locator('.executive-signin').getAttribute('href'),'/login');assert.equal(await page.locator('.executive-brand').getAttribute('href'),'/');
 await page.locator('.executive-access').click();await page.waitForURL('**/signup');await page.goto('http://localhost:3001');await page.locator('.executive-signin').click();await page.waitForURL('**/login');await page.goto('http://localhost:3001');await page.locator('.executive-brand').click();await page.waitForURL('http://localhost:3001/');
 // Mobile language/theme control behavior and section focus survive the animated portal.
 await page.setViewportSize({width:390,height:844});const trigger=page.locator('.executive-menu-trigger');await trigger.focus();await page.keyboard.press('Enter');let dialog=page.getByRole('dialog');await dialog.waitFor();await dialog.getByRole('radio',{name:'اردو',exact:true}).click();await page.waitForFunction(()=>document.documentElement.lang==='ur');assert.equal(await dialog.evaluate(el=>getComputedStyle(el).direction),'rtl');
 const previous=await page.evaluate(()=>document.documentElement.classList.contains('dark'));await dialog.locator('.executive-menu-preferences .ui-button').click();await page.waitForFunction(old=>document.documentElement.classList.contains('dark')!==old,previous);
 await dialog.getByRole('link',{name:translations.ur.landing.navFeatures,exact:true}).click();await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement===document.querySelector('#capabilities h2'));
 for(const mode of ['os','app']){if(mode==='os')await page.emulateMedia({reducedMotion:'reduce'});else{await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>document.documentElement.dataset.motion='reduced');}await page.waitForTimeout(300);const before=await measure();await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(300);const after=await measure();assert.equal(before.height,after.height);assert.equal(await page.locator('.glass-pointer').evaluate(el=>getComputedStyle(el).display),'none');}
 const touch=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await touch.goto('http://localhost:3001');await touch.mouse.move(150,35);await touch.waitForTimeout(350);assert.equal(await touch.locator('.glass-pointer').evaluate(el=>getComputedStyle(el).opacity),'0');await touch.close();
 assert.deepEqual(errors,[]);writeFileSync(`${dir}/checks.json`,JSON.stringify({results,preservedFiles:Object.keys(protectedFiles),interactions:'Shared hover/focus indicator, independent active state, rapid traversal, fixed blur, pointer light, focus trap/restore, scroll lock, live locale/theme, destinations, OS/app reduced motion and touch passed',errors},null,2));console.log(`${results.length} responsive combinations and navigation interaction checks passed; ${Object.keys(protectedFiles).length} protected files unchanged.`);
}finally{await browser.close();}
