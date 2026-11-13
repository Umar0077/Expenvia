import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const stage=process.argv[2]||'after',dir=`screenshots/landing-${stage}`;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch();let checks=0;const errors=[],failures=[];
try {const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(60000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,500));});
 for(const locale of stage==='before'?['en']:['en','ur'])for(const theme of stage==='before'?['light']:['light','dark']){
 await page.context().addCookies([{name:'NEXT_LOCALE',value:locale,url:'http://localhost:3001'}]);await page.goto('http://localhost:3001');await page.evaluate(t=>localStorage.setItem('expenvia-theme',t),theme);await page.reload();await page.locator('h1:visible').waitFor();await page.waitForTimeout(700);
 const sections=[['hero',page.locator('main>section').nth(0)],['capabilities',page.locator('#capabilities')],['branches',page.locator('main>section').nth(3)]];
 for(const [name,section] of sections){await section.scrollIntoViewIfNeeded();await page.waitForTimeout(1200);await section.screenshot({path:`${dir}/${name}-${locale}-${theme}.png`,caret:'initial'});}
 if(stage==='after')for(const width of [320,360,390,430,768,1024,1280,1440,1920]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(120);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);if(overflow>1)failures.push({locale,theme,width,overflow});checks++;}
 await page.setViewportSize({width:1440,height:1000});
 }
 if(stage==='after'){await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://localhost:3001');await page.waitForTimeout(500);if(!await page.locator('.aurora-wave').evaluateAll(els=>els.every(el=>getComputedStyle(el).animationName==='none')))failures.push('reduced motion');
 await page.setViewportSize({width:390,height:1000});await page.locator('#branches').scrollIntoViewIfNeeded();await page.locator('#branches').screenshot({path:`${dir}/branches-mobile-ur.png`,caret:'initial',style:'.marketing > header { visibility: hidden; }'});
 await page.context().addCookies([{name:'NEXT_LOCALE',value:'en',url:'http://localhost:3001'}]);await page.evaluate(()=>localStorage.setItem('expenvia-theme','light'));await page.goto('http://localhost:3001');
 await page.getByRole('button',{name:'Switch to Dark theme'}).click();await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));
 for(const target of ['/login','/signup'])if(!await page.locator(`a[href="${target}"]`).count())failures.push(`Missing ${target}`);
 for(const name of ['Shamsabad Office','Islamabad Office','Commercial Office','Iran Road Office','I-9/2 Office'])if(!await page.locator('#branches').getByText(name,{exact:true}).count())failures.push(`Missing ${name}`);
 }
 const report={checks,failures,errors:[...new Set(errors)]};writeFileSync(`${dir}/checks.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(failures.length||errors.length)process.exitCode=1;
}finally{await browser.close();}
