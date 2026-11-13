import { describe, expect, it } from "vitest";
import { auditPolicy, branchPolicy, canAdmin, expensePolicy, invoicePolicy, type Subject } from "./policy";

const admin: Subject = { userId: "a", role: "SUPER_ADMIN" };
const alice: Subject = { userId: "u1", role: "USER", activeBranchId: "B1" };
const bob: Subject = { userId: "u2", role: "USER", activeBranchId: "B1" };
const vendorA: Subject = { userId: "v1", role: "VENDOR", vendorId: "VA", vendorBranchIds: ["B1", "B2"] };
const vendorB: Subject = { userId: "v2", role: "VENDOR", vendorId: "VB", vendorBranchIds: ["B3"] };

describe("expensePolicy", () => {
  const aliceDraft = { ownerId: "u1", branchId: "B1", status: "DRAFT" as const };
  const aliceSubmitted = { ...aliceDraft, status: "SUBMITTED" as const };

  it("users see only their own expenses", () => {
    expect(expensePolicy.view(alice, aliceDraft)).toBe(true);
    expect(expensePolicy.view(bob, aliceDraft)).toBe(false);
    expect(expensePolicy.view(vendorA, aliceDraft)).toBe(false);
    expect(expensePolicy.view(admin, aliceDraft)).toBe(true);
  });

  it("users create only for their assigned branch", () => {
    expect(expensePolicy.create(alice, "B1")).toBe(true);
    expect(expensePolicy.create(alice, "B2")).toBe(false);
    expect(expensePolicy.create({ ...alice, activeBranchId: null }, "B1")).toBe(false);
    expect(expensePolicy.create(admin, "B1")).toBe(false);
  });

  it("submitted expenses are locked for the owner", () => {
    expect(expensePolicy.edit(alice, aliceDraft)).toBe(true);
    expect(expensePolicy.edit(alice, aliceSubmitted)).toBe(false);
    expect(expensePolicy.edit(alice, { ...aliceDraft, status: "REVISION_REQUESTED" })).toBe(true);
    expect(expensePolicy.edit(bob, aliceDraft)).toBe(false);
  });

  it("only admin reviews, and only reviewable states", () => {
    expect(expensePolicy.review(admin, aliceSubmitted)).toBe(true);
    expect(expensePolicy.review(admin, aliceDraft)).toBe(false);
    expect(expensePolicy.review(alice, aliceSubmitted)).toBe(false);
  });
});

describe("invoicePolicy", () => {
  const invA = { vendorId: "VA", branchId: "B1", status: "DRAFT" as const };

  it("vendors cannot see other vendors' invoices", () => {
    expect(invoicePolicy.view(vendorA, invA)).toBe(true);
    expect(invoicePolicy.view(vendorB, invA)).toBe(false);
    expect(invoicePolicy.view(alice, invA)).toBe(false);
  });

  it("vendors cannot invoice unassigned branches", () => {
    expect(invoicePolicy.create(vendorA, "B2")).toBe(true);
    expect(invoicePolicy.create(vendorA, "B3")).toBe(false);
    expect(invoicePolicy.create(vendorB, "B1")).toBe(false);
  });

  it("removing an assignment blocks editing old drafts for that branch", () => {
    expect(invoicePolicy.edit({ ...vendorA, vendorBranchIds: ["B2"] }, invA)).toBe(false);
  });

  it("vendors never approve or record payments", () => {
    const submitted = { ...invA, status: "SUBMITTED" as const };
    expect(invoicePolicy.review(vendorA, submitted)).toBe(false);
    expect(invoicePolicy.review(admin, submitted)).toBe(true);
    expect(invoicePolicy.recordPayment(vendorA, { ...invA, status: "APPROVED" })).toBe(false);
  });

  it("approval is not payment: only approved invoices accept payments", () => {
    expect(invoicePolicy.recordPayment(admin, { ...invA, status: "SUBMITTED" })).toBe(false);
    expect(invoicePolicy.recordPayment(admin, { ...invA, status: "APPROVED" })).toBe(true);
    expect(invoicePolicy.recordPayment(admin, { ...invA, status: "PARTIALLY_PAID" })).toBe(true);
    expect(invoicePolicy.recordPayment(admin, { ...invA, status: "PAID" })).toBe(false);
  });
});

describe("admin-only areas", () => {
  it("deny users and vendors", () => {
    for (const s of [alice, vendorA]) {
      expect(canAdmin(s, "branch.manage")).toBe(false);
      expect(canAdmin(s, "org.analytics")).toBe(false);
      expect(auditPolicy.view(s)).toBe(false);
      expect(branchPolicy.viewFinancials(s)).toBe(false);
    }
    expect(canAdmin(admin, "audit.view")).toBe(true);
  });

  it("vendors see basic info only for assigned branches", () => {
    expect(branchPolicy.viewBasic(vendorA, "B2")).toBe(true);
    expect(branchPolicy.viewBasic(vendorA, "B3")).toBe(false);
  });
});
