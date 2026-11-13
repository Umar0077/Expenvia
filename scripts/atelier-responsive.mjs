import "dotenv/config";
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
const base="http://localhost:3002",widths=[320,360,390,430,768,1024,1280,1440,1920];
const credentials=readFileSync(".demo-credentials.txt","utf8"),password=/Password for every demo account: (\S+)/.exec(credentials)[1];
const employee=/Employee:\s+(\S+)/.exec(credentials)[1],vendor=/Vendor:\s+(\S+)/.exec(credentials)[1];
if(!/demo/.test(new URL(process.env.DEMO_DATABASE_URL).pathname))throw new Error("Demo only");
const db=new pg.Client({connectionString:process.env.DEMO_DATABASE_URL});await db.connect();await db.query("DELETE FROM rate_limit_buckets");await db.end();
const browser=await chromium.launch();const failures=[],errors=[];let checks=0;
try {
 const page=await browser.newPage();page.setDefaultTimeout(90000);
 page.on("pageerror",e=>errors.push(e.message));
 async function login(email){await page.context().clearCookies();await page.goto(base+"/login");await page.getByLabel(/Email address/i).fill(email);await page.getByLabel(/^Password/i).first().fill(password);await page.getByRole("button",{name:/^Sign in$/}).click();await page.waitForURL(/\/(admin|user|vendor)\/dashboard/);}
 async function scan(paths){for(const locale of ["en","ur"])for(const theme of ["light","dark"]){
  await page.context().addCookies([{name:"NEXT_LOCALE",value:locale,url:base}]);
  await page.evaluate(theme=>localStorage.setItem("expenvia-theme",theme),theme);
  for(const path of paths){await page.goto(base+path);await page.locator("h1").first().waitFor();
   for(const width of widths){await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);
    const overflow=await page.evaluate(()=>({page:document.documentElement.scrollWidth-innerWidth,clipped:[...document.querySelectorAll(".metric-value,.record-amount,.atelier-branch h2")].filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>el.className)}));
    checks++;if(overflow.page>1||overflow.clipped.length)failures.push({path,locale,theme,width,...overflow});
   }
  }
 }}
 await page.goto(base);await scan(["/","/login","/signup"]);
 await login("ceo@demo.expenvia.test");await scan(["/admin/dashboard","/admin/branches","/admin/vendors","/admin/invoices","/admin/reports","/admin/settings","/admin/email-delivery"]);
 await login(employee);await scan(["/user/dashboard","/user/expenses","/user/expenses/new","/user/settings"]);
 await login(vendor);await scan(["/vendor/dashboard","/vendor/invoices","/vendor/invoices/new","/vendor/settings"]);
 await page.context().clearCookies();await page.emulateMedia({reducedMotion:"reduce"});await page.goto(base);await page.waitForTimeout(500);
 const reduced=await page.locator(".aurora-wave").evaluateAll(nodes=>nodes.every(el=>getComputedStyle(el).animationName==="none"));
 if(!reduced)failures.push({motion:"OS reduced motion failed"});
 await page.emulateMedia({reducedMotion:"no-preference"});await page.evaluate(()=>document.documentElement.dataset.motion="reduced");await page.waitForTimeout(200);
 if(!await page.locator(".aurora-wave").evaluateAll(nodes=>nodes.every(el=>getComputedStyle(el).animationName==="none")))failures.push({motion:"App reduced motion failed"});
 const report={checks,failures,errors:[...new Set(errors)],reducedMotion:reduced};writeFileSync("screenshots/atelier-responsive.json",JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(failures.length||errors.length)process.exitCode=1;
}finally{await browser.close();}
