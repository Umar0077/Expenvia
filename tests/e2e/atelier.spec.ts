import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
const credentials=readFileSync(".demo-credentials.txt","utf8");
const password=/Password for every demo account: (\S+)/.exec(credentials)![1]!;
const vendor=/Vendor:\s+(\S+)/.exec(credentials)![1]!;
async function login(page:Page,email:string){await page.goto("/login");await page.getByLabel(/Email address/i).fill(email);await page.getByLabel(/^Password/i).first().fill(password);await page.getByRole("button",{name:/^Sign in$/}).click();await page.waitForURL(/\/(admin|vendor)\/dashboard/);}
test("invoice editor labels hydrate consistently and still focus the correct item",async({page})=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
 await login(page,vendor);await page.goto("/vendor/invoices/new");await page.reload();
 const field=page.getByRole("textbox",{name:"Item / service 1",exact:true});await expect(field).toBeVisible();await field.fill("Hydration check");await expect(field).toHaveValue("Hydration check");
 const id=await field.getAttribute("id");expect(await page.locator(`label[for="${id}"]`).count()).toBe(1);expect(errors).toEqual([]);
});
test("branch cards lift without resizing and aurora respects motion settings",async({page})=>{
 await login(page,"ceo@demo.expenvia.test");await page.goto("/admin/branches");
 const card=page.locator(".atelier-branch").first();await expect(card).toBeVisible();const before=await card.boundingBox();await card.hover();await page.waitForTimeout(400);const after=await card.boundingBox();expect(after!.width).toBeCloseTo(before!.width,1);expect(after!.height).toBeCloseTo(before!.height,1);
 await page.goto("/");await expect(page.locator(".landing-hero .aurora-ribbons")).toBeVisible();
 await page.emulateMedia({reducedMotion:"reduce"});await expect.poll(()=>page.locator(".aurora-wave").first().evaluate(el=>getComputedStyle(el).animationName)).toBe("none");
 await page.emulateMedia({reducedMotion:"no-preference"});await page.evaluate(()=>document.documentElement.dataset.motion="reduced");await expect.poll(()=>page.locator(".aurora-wave").first().evaluate(el=>getComputedStyle(el).animationName)).toBe("none");
});
