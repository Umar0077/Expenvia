import "dotenv/config";
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import pg from "pg";
const credentials=readFileSync(".local-demo-logins.txt","utf8");
const password=/Password:\s*(\S+)/.exec(credentials)[1];
const accounts=Object.fromEntries(["Super Admin","Employee","Vendor"].map(role=>[role,new RegExp(`${role}:\\s*(\\S+)`).exec(credentials)[1]]));
const codes=["SHAMSABAD","ISB-I93","COMMERCIAL","IRAN-ROAD","ISB-I92"];
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const offices=(await db.query("SELECT id,code,address,contact_email,working_days FROM branches WHERE code=ANY($1::text[])",[codes])).rows;
assert.equal(offices.length,5);
for(const office of offices){const r=(await db.query(`SELECT (SELECT count(*) FROM expenses WHERE branch_id=$1)::int expenses,(SELECT count(*) FROM invoices WHERE branch_id=$1)::int invoices,(SELECT count(*) FROM user_branch_assignments WHERE branch_id=$1)::int employees,(SELECT count(*) FROM vendor_branch_assignments WHERE branch_id=$1)::int vendors`,[office.id])).rows[0];assert.deepEqual(r,{expenses:0,invoices:0,employees:0,vendors:0});}
await db.end();
const base="http://localhost:3001",browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(60000);
 page.on("pageerror",e=>console.error("Page error:",e.message));
 page.on("console",msg=>{if(msg.type()==="error")console.error("Browser error:",msg.text().slice(-6500));});
 async function login(role){await page.context().clearCookies();await page.goto(base+"/login");await page.getByLabel(/Email address/i).fill(accounts[role]);await page.getByLabel(/^Password/i).first().fill(password);await page.getByRole("button",{name:/^Sign in$/}).click();await page.waitForURL(/\/(admin|user|vendor)\/dashboard/);}
 await login("Super Admin");
 await page.goto(base+"/admin/branches");for(const code of codes)assert.ok(await page.getByText(code,{exact:true}).count());
 await page.screenshot({path:"screenshots/atelier-after/company-branches-light.png",fullPage:true,caret:"initial"});
 await page.evaluate(()=>localStorage.setItem("expenvia-theme","dark"));await page.reload();await page.screenshot({path:"screenshots/atelier-after/company-branches-dark.png",fullPage:true,caret:"initial"});
 await page.setViewportSize({width:320,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:"screenshots/atelier-after/company-branches-mobile.png",fullPage:true,caret:"initial"});
 await page.setViewportSize({width:1440,height:1000});
 for(const route of ["/admin/dashboard","/admin/expenses","/admin/reports","/admin/vendors"]){await page.goto(base+route);await page.locator("h1:visible").first().waitFor();await page.locator("select:visible option").first().waitFor({state:"attached"});const options=await page.locator("select:visible option").evaluateAll(nodes=>nodes.map(o=>o.value));for(const office of offices)assert.ok(options.includes(office.id),`${route} missing ${office.code}`);}
 await page.goto(base+`/admin/branches/${offices.find(b=>b.code==="SHAMSABAD").id}`);await page.getByRole("button",{name:"Edit branch",exact:true}).click();assert.equal(await page.getByLabel("Additional phone",{exact:true}).inputValue(),"0333-8513359");assert.equal(await page.getByLabel("Opening time",{exact:true}).inputValue(),"18:00");await page.keyboard.press("Escape");
 await page.goto(base+"/admin/email-delivery");await page.getByRole("heading",{name:"Email delivery",exact:true}).waitFor();
 for(const route of ["/admin/users","/admin/vendors"]){await page.goto(base+route);await page.getByRole("button",{name:"Manage",exact:true}).first().click();const dialog=page.getByRole("dialog");await dialog.waitFor();const values=await dialog.locator("select option").evaluateAll(nodes=>nodes.map(n=>n.value));for(const office of offices)assert.ok(values.includes(office.id),`${route} assignment missing ${office.code}`);await page.keyboard.press("Escape");}
 await page.keyboard.press("Control+k");await page.getByRole("combobox").fill("SHAMSABAD");await page.getByRole("option").filter({hasText:"Shamsabad Office"}).waitFor();await page.keyboard.press("Escape");
 for(const [role,path] of [["Employee","/user/expenses/new"],["Vendor","/vendor/invoices/new"]]){await login(role);await page.goto(base+path);const text=await page.locator("main").innerText();for(const code of codes)assert.ok(!text.includes(code),`${role} gained unassigned branch`);await page.goto(base+`/admin/branches/${offices[0].id}`);await page.waitForURL(/\/unauthorized$/);}
 console.log("Five branches verified: zero financial/assignment records, admin filters, contact editor, email center and employee/vendor isolation.");
}finally{await browser.close();}
