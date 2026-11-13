import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { companyBranches, importCompanyBranches } from "@/server/services/branch-import";
import { makeAdmin } from "../support/factories";
import { branchSchema } from "@/lib/validation/org";
afterAll(()=>db.$disconnect());
describe("company branch import",()=>{
 it("creates or matches exactly five offices, preserves history and does not duplicate audit events",async()=>{
  const admin=await makeAdmin();
  const counts=()=>Promise.all([db.expense.count(),db.invoice.count(),db.invoicePayment.count(),db.userBranchAssignment.count(),db.vendorBranchAssignment.count()]);
  const before=await counts();
  const first=await importCompanyBranches(admin);
  const audits=await db.auditLog.count({where:{action:{startsWith:"branch.import_"}}});
  const second=await importCompanyBranches(admin);
  expect(second.map(x=>x.id)).toEqual(first.map(x=>x.id));
  expect(second.every(x=>x.result==="matched")).toBe(true);
  expect(await db.branch.count({where:{code:{in:companyBranches.map(x=>x.code)}}})).toBe(5);
  expect(await db.auditLog.count({where:{action:{startsWith:"branch.import_"}}})).toBe(audits);
  expect(await counts()).toEqual(before);
  const office=await db.branch.findUniqueOrThrow({where:{code:"SHAMSABAD"}});
  expect(office).toMatchObject({secondaryPhone:"0333-8513359",workingDays:"MON_FRI",opensAt:"18:00",closesAt:"04:00",timezone:"Asia/Karachi"});
  const incomplete=await db.branch.findUniqueOrThrow({where:{code:"ISB-I92"}});
  expect(incomplete.workingDays).toBeNull();expect(incomplete.contactEmail||null).toBeNull();
 });
 it("rejects a non-administrator and an identity conflict without partial writes",async()=>{
  const admin=await makeAdmin();
  await expect(importCompanyBranches({...admin,role:"USER"})).rejects.toThrow("Super Admin");
  const office=await db.branch.findUniqueOrThrow({where:{code:"ISB-I92"}});
  await db.branch.update({where:{id:office.id},data:{name:"Unrelated office"}});
  const before=await db.auditLog.count({where:{action:{startsWith:"branch.import_"}}});
  try {await expect(importCompanyBranches(admin)).rejects.toThrow("Identity conflict");expect(await db.auditLog.count({where:{action:{startsWith:"branch.import_"}}})).toBe(before);}
  finally {await db.branch.update({where:{id:office.id},data:{name:office.name}});}
 });
 it("validates phone, timezone and 24-hour office times",()=>{
  expect(branchSchema.safeParse({...companyBranches[0],opensAt:"28:00"}).success).toBe(false);
  expect(branchSchema.safeParse({...companyBranches[0],timezone:"Imaginary/Zone"}).success).toBe(false);
  expect(branchSchema.safeParse({...companyBranches[0],secondaryPhone:"not-a-phone"}).success).toBe(false);
 });
});
