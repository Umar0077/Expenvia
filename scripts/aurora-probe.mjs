import {chromium} from 'playwright';
const browser=await chromium.launch();
try{const page=await browser.newPage({viewport:{width:320,height:844}});for(const locale of ['en','ur']){
 await page.context().addCookies([{name:'NEXT_LOCALE',value:locale,url:'http://localhost:3001'},{name:'expenvia_motion',value:'reduced',url:'http://localhost:3001'}]);await page.goto('http://localhost:3001');await page.waitForTimeout(1200);
 console.log(locale,await page.evaluate(()=>({width:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)&&!el.closest('.living-aurora')&&!el.closest('svg')&&getComputedStyle(el).position!=='absolute';}).slice(0,15).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,80),rect:el.getBoundingClientRect().toJSON()}))})));
 await page.screenshot({path:`screenshots/aurora-after/probe-${locale}-320.png`,caret:'initial'});
}}finally{await browser.close();}
