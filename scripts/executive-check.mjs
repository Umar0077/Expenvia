import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const dir = 'screenshots/executive-after', reports = [], errors = [];
for (const [file, hash] of Object.entries(JSON.parse(readFileSync('screenshots/executive-before/preserved.json', 'utf8')))) assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), hash, `${file} preserved`);
const messages = Object.fromEntries(['en','ur'].map(locale=>[locale,JSON.parse(readFileSync(`messages/${locale}.json`,'utf8'))]));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror', error=>errors.push(error.message));
  for (const locale of ['en','ur']) for (const theme of ['light','dark']) {
    await page.context().addCookies([{name:'NEXT_LOCALE',value:locale,url:'http://localhost:3001'},{name:'expenvia_motion',value:'reduced',url:'http://localhost:3001'}]);
    await page.goto('http://localhost:3001');await page.evaluate(t=>localStorage.setItem('expenvia-theme',t),theme);await page.reload();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(700);
    for (const width of [320,360,390,430,768,1024,1280,1440,1920]) {
      await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(150);
      const layout=await page.evaluate(()=>{
        const box=el=>el.getBoundingClientRect(), visible=el=>box(el).width>0&&box(el).height>0&&getComputedStyle(el).visibility!=='hidden';
        const bar=document.querySelector('.executive-bar'), b=box(bar), h=box(document.querySelector('.landing-hero')), chart=box(document.querySelector('.executive-preview-chart')), panel=box(document.querySelector('.executive-preview-main'));
        const controls=[...bar.querySelectorAll('a,button')].filter(visible);
        const clipped=controls.filter(el=>{const r=box(el);return r.left<b.left||r.right>b.right||r.top<b.top||r.bottom>b.bottom;}).map(el=>el.textContent||el.getAttribute('aria-label'));
        const textOverflow=[...document.querySelectorAll('.executive-preview-label,.executive-preview-value,.hero-headline,.hero-description')].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.textContent);
        const invoice=box(document.querySelector('.executive-preview-invoice'));
        return {overflow:document.documentElement.scrollWidth>innerWidth+1,clipped,textOverflow,chartContained:chart.bottom<=panel.bottom&&chart.left>=panel.left&&chart.right<=panel.right,invoiceClear:invoice.bottom<=panel.top+1,heroContainsPreview:panel.bottom<=h.bottom,logoWidth:box(bar.querySelector('.brand-logo-navigation')).width,heroHeight:h.height,headerHeight:box(document.querySelector('.executive-header')).height};
      });
      assert.equal(layout.overflow,false,`${locale}/${theme}/${width}`);assert.deepEqual(layout.clipped,[],`${locale}/${width}: controls`);assert.deepEqual(layout.textOverflow,[],`${locale}/${width}: text`);assert.ok(layout.chartContained&&layout.invoiceClear&&layout.heroContainsPreview,`${locale}/${width}: preview ${JSON.stringify(layout)}`);
      assert.ok(layout.logoWidth>=122);
      if(width<1280){
        await page.getByRole('button',{name:messages[locale].nav.openMenu,exact:true}).click();const menu=page.getByRole('dialog');await menu.waitFor();
        assert.equal(await menu.evaluate(el=>getComputedStyle(el).direction),locale==='ur'?'rtl':'ltr');
        for(const key of ['navFeatures','navWorkflow','navSecurity','signIn','getStarted'])assert.ok(await menu.getByRole('link',{name:messages[locale].landing[key],exact:true}).isVisible());
        assert.ok(await menu.getByRole('radiogroup').isVisible());assert.ok(await menu.getByRole('button',{name:messages[locale].preferences.toggleTheme.replace('{mode}',theme==='light'?messages[locale].preferences.themeDark:messages[locale].preferences.themeLight)}).isVisible());
        assert.ok(await menu.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight;}));
        if(width===320||width===768)await page.screenshot({path:`${dir}/${locale}-${theme}-${width}-menu.png`});
        await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement===document.querySelector('.executive-menu-trigger'));
      }
      reports.push({locale,theme,width,...layout});
    }
  }
  // Live full-motion header/hover/active navigation behavior.
  await page.context().addCookies([{name:'NEXT_LOCALE',value:'en',url:'http://localhost:3001'},{name:'expenvia_motion',value:'system',url:'http://localhost:3001'}]);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:1000});await page.goto('http://localhost:3001');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1200);
  const initial=await page.locator('.executive-bar').evaluate(el=>({transform:getComputedStyle(el).transform,fill:parseFloat(el.style.getPropertyValue('--bar-fill'))}));
  await page.evaluate(()=>scrollTo(0,300));await page.waitForTimeout(800);
  const scrolled=await page.locator('.executive-bar').evaluate(el=>({transform:getComputedStyle(el).transform,fill:parseFloat(el.style.getPropertyValue('--bar-fill'))}));
  assert.notEqual(initial.transform,scrolled.transform);assert.ok(scrolled.fill>initial.fill);
  const access=page.locator('.executive-header .executive-access');const before=await access.boundingBox();await access.hover();await page.waitForTimeout(300);const after=await access.boundingBox();assert.ok(after.y<before.y);assert.equal(after.width,before.width);
  for(const id of ['workflow','capabilities','security']){await page.evaluate(id=>{const el=document.getElementById(id);scrollTo(0,el.offsetTop-innerHeight*.24);},id);await page.waitForTimeout(400);assert.equal(await page.locator(`.executive-links a[href="#${id}"]`).getAttribute('aria-current'),'location');}
  await page.screenshot({path:`${dir}/desktop-scrolled-active.png`});
  // Keyboard mobile navigation, focus destination, and live language/theme controls.
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));const trigger=page.getByRole('button',{name:'Open menu',exact:true});await trigger.focus();await page.keyboard.press('Enter');let menu=page.getByRole('dialog');await menu.waitFor();await menu.getByRole('link',{name:'Capabilities',exact:true}).click();await page.waitForTimeout(300);assert.equal(await menu.count(),0);assert.ok(await page.locator('#capabilities h2').evaluate(el=>el===document.activeElement));
  await trigger.click();await page.getByRole('dialog').getByRole('radio',{name:'اردو',exact:true}).click();await page.waitForFunction(()=>document.documentElement.lang==='ur');assert.equal(await page.getByRole('dialog').evaluate(el=>getComputedStyle(el).direction),'rtl');
  const darkBefore=await page.evaluate(()=>document.documentElement.classList.contains('dark'));await page.getByRole('dialog').locator('.executive-menu-preferences .ui-button').click();await page.waitForFunction(was=>document.documentElement.classList.contains('dark')!==was,darkBefore);await page.keyboard.press('Escape');
  for(const preference of ['os','app']){
    if(preference==='os')await page.emulateMedia({reducedMotion:'reduce'});else {await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>document.documentElement.dataset.motion='reduced');}
    await page.waitForTimeout(300);assert.equal(await page.locator('.executive-float').first().evaluate(el=>getComputedStyle(el).animationName),'none');assert.equal(await page.locator('.executive-bar').evaluate(el=>getComputedStyle(el).transform),'none');
  }
  assert.deepEqual(errors,[]);writeFileSync(`${dir}/checks.json`,JSON.stringify({reports,motion:{initial,scrolled},interactions:'Active sections, hover lift, mobile keyboard/focus, live language/theme and OS/app reduced motion passed',errors},null,2));
  console.log(`${reports.length} responsive combinations and live navigation/motion checks passed; no browser errors.`);
} finally {await browser.close();}
