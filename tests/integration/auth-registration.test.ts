import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { authenticate, issueToken, registerAccount, resetPassword, verifyEmail } from "@/server/services/auth-service";
import { approveRegistration, rejectRegistration } from "@/server/services/registration-service";
import { makeAdmin, makeBranch, uid } from "../support/factories";

afterAll(() => db.$disconnect());

const PASSWORD = "Integration-Test-77";

function signup(overrides: Record<string, unknown> = {}) {
  return registerAccount({
    accountType: "USER",
    fullName: "Ayesha Khan",
    email: `ayesha-${uid()}@test.local`,
    phone: "",
    password: PASSWORD,
    confirmPassword: PASSWORD,
    acceptTerms: true,
    ...overrides,
  } as never);
}

describe("registration → verification → approval", () => {
  it("new accounts start pending with no role, even if a role is smuggled in", async () => {
    const res = await signup({ role: "SUPER_ADMIN", accountType: "USER" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const user = await db.user.findUniqueOrThrow({ where: { id: res.userId } });
    expect(user.role).toBeNull();
    expect(user.status).toBe("PENDING_VERIFICATION");
  });

  it("rejects SUPER_ADMIN as a requested account type", async () => {
    const res = await signup({ accountType: "SUPER_ADMIN" });
    expect(res).toEqual({ ok: false, error: "invalid" });
  });

  it("rejects duplicate emails", async () => {
    const email = `dup-${uid()}@test.local`;
    expect((await signup({ email })).ok).toBe(true);
    expect(await signup({ email: email.toUpperCase() })).toEqual({ ok: false, error: "emailTaken" });
  });

  it("authenticates with correct password only", async () => {
    const email = `login-${uid()}@test.local`;
    await signup({ email });
    expect(await authenticate(email, "wrong-password-1")).toBeNull();
    expect(await authenticate(`nobody-${uid()}@test.local`, PASSWORD)).toBeNull();
    expect((await authenticate(email, PASSWORD))?.status).toBe("PENDING_VERIFICATION");
  });

  it("verification tokens are single-use and move the account to review", async () => {
    const res = await signup();
    if (!res.ok) throw new Error("signup failed");
    expect((await verifyEmail(res.verifyToken)).ok).toBe(true);
    expect((await verifyEmail(res.verifyToken)).ok).toBe(false);
    const user = await db.user.findUniqueOrThrow({ where: { id: res.userId } });
    expect(user.status).toBe("PENDING_APPROVAL");
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it("approval assigns role + branch exactly once, even under concurrency", async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch(admin.userId);
    const res = await signup();
    if (!res.ok) throw new Error("signup failed");
    await verifyEmail(res.verifyToken);
    const reg = await db.registrationRequest.findUniqueOrThrow({ where: { userId: res.userId } });

    const results = await Promise.allSettled([
      approveRegistration(admin, { id: reg.id, branchIds: [branch.id] }),
      approveRegistration(admin, { id: reg.id, branchIds: [branch.id] }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const user = await db.user.findUniqueOrThrow({ where: { id: res.userId }, include: { branchAssignments: true } });
    expect(user.role).toBe("USER");
    expect(user.status).toBe("ACTIVE");
    expect(user.branchAssignments).toHaveLength(1);
    const audits = await db.auditLog.count({ where: { action: "registration.approved", entityId: res.userId } });
    expect(audits).toBe(1);
  });

  it("vendor approval creates a vendor profile with branch assignments", async () => {
    const admin = await makeAdmin();
    const [b1, b2] = [await makeBranch(admin.userId), await makeBranch(admin.userId)];
    const res = await signup({ accountType: "VENDOR", businessName: "Al-Noor Supplies", phone: "+92 300 1234567" });
    if (!res.ok) throw new Error("signup failed");
    await verifyEmail(res.verifyToken);
    const reg = await db.registrationRequest.findUniqueOrThrow({ where: { userId: res.userId } });
    await approveRegistration(admin, { id: reg.id, branchIds: [b1.id, b2.id] });
    const vendor = await db.vendorProfile.findUniqueOrThrow({ where: { userId: res.userId }, include: { branchAssignments: true } });
    expect(vendor.businessName).toBe("Al-Noor Supplies");
    expect(vendor.branchAssignments).toHaveLength(2);
  });

  it("cannot approve unverified applicants or assign inactive branches", async () => {
    const admin = await makeAdmin();
    const res = await signup();
    if (!res.ok) throw new Error("signup failed");
    const reg = await db.registrationRequest.findUniqueOrThrow({ where: { userId: res.userId } });
    await expect(approveRegistration(admin, { id: reg.id, branchIds: [] })).rejects.toThrow("notVerified");

    await verifyEmail(res.verifyToken);
    const inactive = await makeBranch(admin.userId, "INACTIVE");
    await expect(approveRegistration(admin, { id: reg.id, branchIds: [inactive.id] })).rejects.toThrow("branchInactive");
  });

  it("rejection revokes sessions and keeps the internal note private to the record", async () => {
    const admin = await makeAdmin();
    const res = await signup();
    if (!res.ok) throw new Error("signup failed");
    await verifyEmail(res.verifyToken);
    await db.session.create({ data: { userId: res.userId, tokenHash: `h-${uid()}`, expiresAt: new Date(Date.now() + 3600_000) } });
    const reg = await db.registrationRequest.findUniqueOrThrow({ where: { userId: res.userId } });
    await rejectRegistration(admin, { id: reg.id, publicMessage: "Please apply through HR", internalNote: "Not an employee" });
    expect(await db.session.count({ where: { userId: res.userId, revokedAt: null } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: res.userId } })).status).toBe("REJECTED");
  });

  it("password reset tokens are single-use and sign out every device", async () => {
    const email = `reset-${uid()}@test.local`;
    const res = await signup({ email });
    if (!res.ok) throw new Error("signup failed");
    await db.session.create({ data: { userId: res.userId, tokenHash: `h-${uid()}`, expiresAt: new Date(Date.now() + 3600_000) } });
    const token = await issueToken(res.userId, "PASSWORD_RESET");
    expect((await resetPassword(token, "Brand-New-Pass-9")).ok).toBe(true);
    expect((await resetPassword(token, "Another-Pass-99")).ok).toBe(false);
    expect(await authenticate(email, PASSWORD)).toBeNull();
    expect(await authenticate(email, "Brand-New-Pass-9")).not.toBeNull();
    expect(await db.session.count({ where: { userId: res.userId, revokedAt: null } })).toBe(0);
  });
});
