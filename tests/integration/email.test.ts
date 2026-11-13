import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { queueEmail } from "@/server/email/service";
import { claimEmail, processEmail, retryDelay, retryEmail } from "@/server/email/worker";
import { DeliveryError, type EmailProvider } from "@/server/email/provider";
import { decryptPayload } from "@/server/email/crypto";
import { registerAccount, verifyEmail, issueToken, resetPassword } from "@/server/services/auth-service";
import { approveRegistration, rejectRegistration } from "@/server/services/registration-service";
import { assignEmployeeBranch, addVendorBranch, removeVendorBranch, setAccountSuspended } from "@/server/services/org-service";
import { saveExpense, reviewExpenses } from "@/server/services/expense-service";
import { saveInvoice, reviewInvoice, recordPayment } from "@/server/services/invoice-service";
import { rateLimit } from "@/server/auth/rate-limit";
import { makeAdmin, makeBranch, makeEmployee, makeVendor, makeCategory, uid } from "../support/factories";

afterAll(() => db.$disconnect());
const accepted: EmailProvider = { name:"mock", async send() { return {preview:false,reference:"mock-reference"}; } };
async function job(event: "password_changed" | "expense_approved" = "password_changed") {
  const admin = await makeAdmin();
  const id = await db.$transaction(tx => queueEmail(tx,{userId:admin.userId,event,key:`test-${uid()}`}));
  return {id:id!,admin};
}
async function claim(id: string) {
  const claimId = crypto.randomUUID();
  await db.emailOutbox.update({where:{id},data:{status:"PROCESSING",claimId,attempts:{increment:1},lockedUntil:new Date(Date.now()+120000)}});
  return {id,claimId};
}
const signup = (type:"USER"|"VENDOR" = "USER") => registerAccount({accountType:type,fullName:"Email Test",email:`mail-${uid()}@test.local`,phone:"+923001234567",password:"Test-Password-99",confirmPassword:"Test-Password-99",acceptTerms:true,businessName:"Business"},"ur");

describe("durable outbox", () => {
  it("persists one message per idempotency key and rolls back with business changes", async () => {
    const admin = await makeAdmin(), key = uid();
    await Promise.all([1,2].map(() => db.$transaction(tx => queueEmail(tx,{userId:admin.userId,event:"password_changed",key}))));
    expect(await db.emailOutbox.count({where:{idempotencyKey:`${key}:${admin.userId}`}})).toBe(1);
    await expect(db.$transaction(async tx => { await queueEmail(tx,{userId:admin.userId,event:"password_changed",key:`rollback-${key}`}); throw new Error("rollback"); })).rejects.toThrow();
    expect(await db.emailOutbox.count({where:{idempotencyKey:`rollback-${key}:${admin.userId}`}})).toBe(0);
  });
  it("records SMTP acceptance and purges message content", async () => {
    const {id} = await job(); await processEmail(await claim(id),accepted);
    expect(await db.emailOutbox.findUnique({where:{id}})).toMatchObject({status:"SENT",attempts:1,payload:null,provider:"mock"});
  });
  it("distinguishes previews from actual delivery", async () => {
    const {id} = await job(); await processEmail(await claim(id),{name:"mock-preview",async send(){return {preview:true,reference:"local"};}});
    expect(await db.emailOutbox.findUnique({where:{id}})).toMatchObject({status:"PREVIEWED",sentAt:null,payload:null});
  });
  it("retries temporary failures with bounded exponential backoff", async () => {
    const {id} = await job();
    const fail:EmailProvider = {name:"mock",async send(){throw new DeliveryError("TEMPORARY_TRANSPORT",true);}};
    await processEmail(await claim(id),fail);
    expect(await db.emailOutbox.findUnique({where:{id}})).toMatchObject({status:"RETRY_SCHEDULED",attempts:1});
    expect(retryDelay(2)).toBeGreaterThan(retryDelay(1)); expect(retryDelay(100)).toBe(3600000);
    await db.emailOutbox.update({where:{id},data:{attempts:4}});
    await processEmail(await claim(id),fail);
    expect(await db.emailOutbox.findUnique({where:{id}})).toMatchObject({status:"FAILED",attempts:5});
    expect(await db.auditLog.count({where:{entityId:id,action:"email.delivery_failed"}})).toBe(1);
  });
  it("fails permanent errors and permits a bounded, audited admin retry", async () => {
    const {id,admin} = await job();
    await processEmail(await claim(id),{name:"mock",async send(){throw new DeliveryError("RECIPIENT_REJECTED",false);}});
    expect((await db.emailOutbox.findUniqueOrThrow({where:{id}})).status).toBe("FAILED");
    expect(await db.$transaction(tx=>retryEmail(tx,id,admin.userId))).toBe(true);
    expect(await db.$transaction(tx=>retryEmail(tx,id,admin.userId))).toBe(false);
    await processEmail(await claim(id),accepted);
    expect((await db.emailOutbox.findUniqueOrThrow({where:{id}})).status).toBe("SENT");
  });
  it("serializes competing processing calls and recovers an abandoned claim", async () => {
    const {id} = await job(); let calls = 0;
    const provider:EmailProvider = {name:"mock",async send(){calls++; await new Promise(r=>setTimeout(r,100));return {preview:false,reference:"one"};}};
    const c = await claim(id);
    await Promise.all([processEmail(c,provider),processEmail(c,provider)]);
    expect(calls).toBe(1);
    const other = await job(); const stale = await claim(other.id);
    await db.emailOutbox.update({where:{id:other.id},data:{lockedUntil:new Date(0),nextAttemptAt:new Date(0)}});
    const recovered = await claimEmail(); expect(recovered?.id).toBe(other.id);
    expect(recovered?.claimId).not.toBe(stale.claimId);
    await processEmail(stale,provider); expect(calls).toBe(1);
    await processEmail(recovered!,provider); expect(calls).toBe(2);
  });
  it("claims different jobs concurrently", async () => {
    const a=await job(),b=await job();
    await db.emailOutbox.updateMany({where:{id:{in:[a.id,b.id]}},data:{nextAttemptAt:new Date(0)}});
    const claims = await Promise.all([claimEmail(),claimEmail()]);
    expect(new Set(claims.map(c=>c?.id))).toEqual(new Set([a.id,b.id]));
    await Promise.all(claims.map(c=>processEmail(c!,accepted)));
  });
  it("honors email preferences independently and never disables security email", async () => {
    const admin=await makeAdmin();
    await db.userPreference.create({data:{userId:admin.userId,emailExpenseUpdates:false,emailActivityUpdates:false}});
    expect(await db.$transaction(tx=>queueEmail(tx,{userId:admin.userId,event:"expense_approved"}))).toBeNull();
    const id=await db.$transaction(tx=>queueEmail(tx,{userId:admin.userId,event:"password_changed"})); expect(id).toBeTruthy();
    await processEmail(await claim(id!),accepted);
  });
  it("rechecks recipient status and preferences before delivery", async () => {
    const {id,admin}=await job("expense_approved");
    await db.user.update({where:{id:admin.userId},data:{status:"SUSPENDED"}});
    await processEmail(await claim(id),{name:"mock",async send(){throw new Error("must not send");}});
    expect((await db.emailOutbox.findUniqueOrThrow({where:{id}})).status).toBe("CANCELLED");
  });
});

describe("authentication email lifecycle", () => {
  it("queues localized encrypted verification atomically and preserves pending approval", async () => {
    const r=await signup(); if(!r.ok) throw new Error("registration");
    const message=await db.emailOutbox.findFirstOrThrow({where:{userId:r.userId,eventType:"verification"}});
    expect(message.language).toBe("ur"); expect(message.payload).not.toContain(r.verifyToken);
    expect(JSON.stringify(decryptPayload(message.payload!))).toContain(r.verifyToken);
    expect(await verifyEmail(r.verifyToken)).toMatchObject({ok:true}); expect(await verifyEmail(r.verifyToken)).toMatchObject({ok:false});
    expect((await db.user.findUniqueOrThrow({where:{id:r.userId}})).status).toBe("PENDING_APPROVAL");
    await processEmail(await claim(message.id),accepted);
    expect((await db.emailOutbox.findUniqueOrThrow({where:{id:message.id}})).status).toBe("CANCELLED");
  });
  it("rejects expired/invalid tokens and resets passwords with session invalidation", async () => {
    const r=await signup(); if(!r.ok) throw new Error("registration");
    await db.authToken.updateMany({where:{userId:r.userId},data:{expiresAt:new Date(0)}});
    expect((await verifyEmail(r.verifyToken)).ok).toBe(false); expect((await verifyEmail("invalid")).ok).toBe(false);
    const expired=await issueToken(r.userId,"PASSWORD_RESET");
    await db.authToken.updateMany({where:{userId:r.userId,purpose:"PASSWORD_RESET"},data:{expiresAt:new Date(0)}});
    expect((await resetPassword(expired,"Another-password-99")).ok).toBe(false);
    const fresh=await issueToken(r.userId,"PASSWORD_RESET");
    await db.session.create({data:{userId:r.userId,tokenHash:uid(),expiresAt:new Date(Date.now()+99999)}});
    expect((await resetPassword(fresh,"Another-password-99")).ok).toBe(true);
    expect((await resetPassword(fresh,"Another-password-99")).ok).toBe(false);
    expect(await db.session.count({where:{userId:r.userId,revokedAt:null}})).toBe(0);
    expect(await db.emailOutbox.count({where:{userId:r.userId,eventType:"password_changed"}})).toBe(1);
  });
  it("uses a concurrent database rate limit for resend cooldowns", async () => {
    const key=`email-cooldown-${uid()}`;
    expect((await Promise.all([rateLimit(key,1,60),rateLimit(key,1,60)])).filter(Boolean)).toHaveLength(1);
  });
});

describe("business email recipients and content", () => {
  it("queues employee/vendor approval and assignment, rejection without internal notes, and suspension", async () => {
    const admin=await makeAdmin(),branch=await makeBranch(admin.userId);
    for(const type of ["USER","VENDOR"] as const) {
      const r=await signup(type);if(!r.ok)throw new Error("registration");await verifyEmail(r.verifyToken);
      const reg=await db.registrationRequest.findUniqueOrThrow({where:{userId:r.userId}});
      await approveRegistration(admin,{id:reg.id,branchIds:[branch.id]});
      expect(await db.emailOutbox.count({where:{userId:r.userId,eventType:"account_approved"}})).toBe(1);
      expect(await db.emailOutbox.count({where:{userId:r.userId,eventType:type==="USER"?"branch_assigned":"vendor_branchAssigned"}})).toBe(1);
      await setAccountSuspended(admin,r.userId,true);
      expect(await db.emailOutbox.count({where:{userId:r.userId,eventType:"account_suspended"}})).toBe(1);
    }
    const r=await signup();if(!r.ok)throw new Error("registration");await verifyEmail(r.verifyToken);
    const reg=await db.registrationRequest.findUniqueOrThrow({where:{userId:r.userId}});
    await rejectRegistration(admin,{id:reg.id,publicMessage:"Contact HR",internalNote:"PRIVATE INTERNAL NOTE"});
    const m=await db.emailOutbox.findFirstOrThrow({where:{userId:r.userId,eventType:"account_rejected"}});
    expect(JSON.stringify(decryptPayload(m.payload!))).toContain("Contact HR");expect(JSON.stringify(decryptPayload(m.payload!))).not.toContain("PRIVATE INTERNAL NOTE");
  });
  it("queues branch changes and expense decisions only for the owner", async () => {
    const admin=await makeAdmin(),branch=await makeBranch(admin.userId),employee=await makeEmployee(admin.userId,null),category=await makeCategory();
    await assignEmployeeBranch(admin,employee.userId,branch.id);
    for(const decision of ["APPROVED","REJECTED","REVISION_REQUESTED"] as const) {
      const e=await saveExpense(employee,{data:{title:"Supplies",amount:"100",currency:"PKR",expenseDate:"2026-11-12",categoryId:category.id},submit:true});
      await reviewExpenses(admin,{ids:[e.id],decision,note:"User-facing explanation"});
      const messages=await db.emailOutbox.findMany({where:{entityId:e.id,eventType:{not:"expense_submitted"}}});
      expect(messages).toHaveLength(1);expect(messages[0]!.userId).toBe(employee.userId);
    }
  });
  it("queues invoice submissions, decisions, partial payments and branch updates", async () => {
    const admin=await makeAdmin(),branch=await makeBranch(admin.userId),vendor=await makeVendor(admin.userId,[]);
    await addVendorBranch(admin,vendor.vendorId,branch.id);
    for(const decision of ["APPROVED","REJECTED","REVISION_REQUESTED"] as const) {
      const inv=await saveInvoice(vendor,{data:{branchId:branch.id,currency:"PKR",invoiceDate:"2026-11-12",lines:[{itemName:"Paper",quantity:"1",unit:"box",unitPrice:"100",taxRate:"0",discount:"0"}]},submit:true});
      await reviewInvoice(admin,{id:inv.id,decision,note:"Public reason"});
      expect(await db.emailOutbox.count({where:{entityId:inv.id,userId:vendor.userId,eventType:"invoice_submissionConfirmed"}})).toBe(1);
      if(decision==="APPROVED") {
        const payment={invoiceId:inv.id,amount:"40",paymentDate:"2026-11-12",idempotencyKey:crypto.randomUUID()};
        await recordPayment(admin,payment);await recordPayment(admin,payment);
        const messages=await db.emailOutbox.findMany({where:{entityId:inv.id,eventType:"invoice_paymentRecorded"}});
        expect(messages).toHaveLength(1);expect(messages[0]!.userId).toBe(vendor.userId);
        const p=decryptPayload(messages[0]!.payload!) as {details:Record<string,string>};
        expect(p.details.balance).toBe("PKR 60");expect(p.details.status).toBe("PARTIALLY_PAID");
      }
    }
    await removeVendorBranch(admin,vendor.vendorId,branch.id);
    expect(await db.emailOutbox.count({where:{userId:vendor.userId,eventType:"vendor_branchRemoved"}})).toBe(1);
  });
});
