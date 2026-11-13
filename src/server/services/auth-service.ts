import "server-only";
import { db, type Tx } from "@/server/db";
import type { TokenPurpose } from "@/generated/prisma/enums";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/server/auth/password";
import { generateToken, hashToken } from "@/server/auth/tokens";
import { resetSchema, signUpSchema, type SignUpInput } from "@/lib/validation/auth";
import { notifyAdmins } from "./notify";
import { queueEmail } from "@/server/email/service";

/**
 * Framework-free auth logic (no cookies/headers) so it can be integration-tested.
 * Server actions wrap these with sessions, rate limiting and auditing.
 */

const TOKEN_TTL_MIN: Record<TokenPurpose, number> = {
  EMAIL_VERIFICATION: 60 * 24,
  PASSWORD_RESET: 60,
};

export async function issueToken(userId: string, purpose: TokenPurpose, tx?: Tx): Promise<string> {
  if (!tx) return db.$transaction(client => issueToken(userId, purpose, client));
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
  const raw = generateToken();
  await tx.authToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } });
  const token = await tx.authToken.create({
      data: { userId, purpose, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + TOKEN_TTL_MIN[purpose] * 60_000) },
    });
  await queueEmail(tx, { userId, event: purpose === "EMAIL_VERIFICATION" ? "verification" : "password_reset", key: `auth:${token.id}`, authTokenId: token.id,
    path: `${purpose === "EMAIL_VERIFICATION" ? "/verify-email" : "/reset-password"}?token=${raw}` });
  return raw;
}

/** Atomically consumes a single-use token. Returns the owner id or null. */
export async function consumeToken(raw: string, purpose: TokenPurpose, tx: Tx = db): Promise<string | null> {
  const res = await tx.authToken.updateManyAndReturn({
    where: { tokenHash: hashToken(raw), purpose, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
    select: { userId: true },
  });
  return res[0]?.userId ?? null;
}

export type RegisterResult = { ok: true; userId: string; verifyToken: string } | { ok: false; error: "emailTaken" | "invalid" };

/** Creates a PENDING account. Role is never taken from input — only the requested type. */
export async function registerAccount(input: SignUpInput, locale: "en" | "ur" = "en"): Promise<RegisterResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;

  const existing = await db.user.findUnique({ where: { email: v.email }, select: { id: true } });
  if (existing) {
    await burnPasswordCheck(v.password);
    return { ok: false, error: "emailTaken" };
  }

  const passwordHash = await hashPassword(v.password);
  try {
    const user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: v.email,
          fullName: v.fullName,
          phone: v.phone || null,
          passwordHash,
          role: null,
          status: "PENDING_VERIFICATION",
          preferences: { create: { locale } },
          registration: {
            create: {
              requestedType: v.accountType,
              businessName: v.accountType === "VENDOR" ? v.businessName : null,
              businessAddress: v.accountType === "VENDOR" ? v.businessAddress || null : null,
              businessCategory: v.accountType === "VENDOR" ? v.businessCategory || null : null,
              taxIdentifier: v.accountType === "VENDOR" ? v.taxIdentifier || null : null,
              applicantNote: v.applicantNote || null,
              termsAcceptedAt: new Date(),
            },
          },
        },
      });
      await tx.auditLog.create({
        data: { actorId: u.id, action: "registration.submitted", entityType: "user", entityId: u.id, summary: { requestedType: v.accountType } },
      });
      const verifyToken = await issueToken(u.id, "EMAIL_VERIFICATION", tx);
      await queueEmail(tx, { userId: u.id, event: v.accountType === "VENDOR" ? "vendor_registration_received" : "registration_received", key: `registration:${u.id}`, path: "/verify-email" });
      return { ...u, verifyToken };
    });
    return { ok: true, userId: user.id, verifyToken: user.verifyToken };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { ok: false, error: "emailTaken" };
    throw e;
  }
}

export interface AuthenticatedUser {
  id: string;
  status: string;
  role: string | null;
}

/** Constant-ish time credential check. */
export async function authenticate(email: string, password: string): Promise<AuthenticatedUser | null> {
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, passwordHash: true, status: true, role: true },
  });
  if (!user) {
    await burnPasswordCheck(password);
    return null;
  }
  if (!(await verifyPassword(user.passwordHash, password))) return null;
  return { id: user.id, status: user.status, role: user.role };
}

export async function verifyEmail(raw: string): Promise<{ ok: boolean; userId?: string }> {
  return db.$transaction(async (tx) => {
  const userId = await consumeToken(raw, "EMAIL_VERIFICATION", tx);
  if (!userId) return { ok: false };
  const user = await tx.user.findUnique({ where: { id: userId }, include: { registration: true } });
  if (!user) return { ok: false };
    await tx.user.update({
      where: { id: userId },
      data: {
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        // Only advance the pre-review state; never touch active/suspended/rejected accounts.
        ...(user.status === "PENDING_VERIFICATION" ? { status: "PENDING_APPROVAL" } : {}),
      },
    });
    await tx.auditLog.create({ data: { actorId: userId, action: "auth.email_verified", entityType: "user", entityId: userId } });
    if (user.status === "PENDING_VERIFICATION" && user.registration) {
      await notifyAdmins(
        {
          type: "registration_pending",
          params: { name: user.fullName, type: user.registration.requestedType },
          entityType: "registration",
          entityId: user.registration.id,
          href: `/admin/registrations?id=${user.registration.id}`,
        },
        tx,
      );
    }
  return { ok: true, userId };
  });
}

export async function resetPassword(raw: string, newPassword: string): Promise<{ ok: boolean; userId?: string }> {
  if (!resetSchema.safeParse({ token: raw, password: newPassword, confirmPassword: newPassword }).success) return { ok: false };
  const passwordHash = await hashPassword(newPassword);
  return db.$transaction(async tx => {
    const userId = await consumeToken(raw, "PASSWORD_RESET", tx);
    if (!userId) return { ok: false };
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    // Password change signs out every device
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: userId, action: "auth.password_reset", entityType: "user", entityId: userId } });
    await queueEmail(tx, { userId, event: "password_changed", path: "/login" });
  return { ok: true, userId };
  });
}
