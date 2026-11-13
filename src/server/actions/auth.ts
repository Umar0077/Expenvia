"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { fieldErrors, forgotSchema, resetSchema, signInSchema, signUpSchema } from "@/lib/validation/auth";
import { audit } from "@/server/audit";
import { rateLimit } from "@/server/auth/rate-limit";
import { clientIp, createSession, dashboardFor, destroySession, getSessionState, statusRoute } from "@/server/auth/session";
import { db } from "@/server/db";
import { authenticate, issueToken, registerAccount, resetPassword, verifyEmail } from "@/server/services/auth-service";
import type { Role } from "@/generated/prisma/enums";

export type FormResult = { ok: true; message?: string } | { ok: false; error?: string; fields?: Record<string, string> };

async function ipKey() {
  return clientIp(await headers()) ?? "local";
}

// ─── Sign in ───
export async function signInAction(input: unknown): Promise<FormResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error) };
  const { email, password } = parsed.data;

  const ip = await ipKey();
  const allowed = (await rateLimit(`login:ip:${ip}`, 30, 900)) && (await rateLimit(`login:email:${email}`, 8, 900));
  if (!allowed) {
    await audit({ action: "auth.login", outcome: "DENIED", entityType: "user", summary: { reason: "rate_limited", email } });
    return { ok: false, error: "rateLimited" };
  }

  const user = await authenticate(email, password);
  if (!user) {
    await audit({ action: "auth.login", outcome: "FAILURE", entityType: "user", summary: { email } });
    return { ok: false, error: "invalidCredentials" };
  }

  await createSession(user.id);
  await audit({ actorId: user.id, actorRole: (user.role as Role) ?? null, action: "auth.login", entityType: "user", entityId: user.id });
  redirect(user.status === "ACTIVE" && user.role ? dashboardFor(user.role as Role) : statusRoute(user.status));
}

// ─── Sign up ───
export async function signUpAction(input: unknown): Promise<FormResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error) };

  if (!(await rateLimit(`signup:ip:${await ipKey()}`, 6, 3600))) return { ok: false, error: "rateLimited" };

  const res = await registerAccount(parsed.data, (await getLocale()) === "ur" ? "ur" : "en");
  if (!res.ok) {
    if (res.error === "emailTaken") return { ok: true, message: "registrationNeutral" };
    return { ok: false, error: "genericError" };
  }

  return { ok: true, message: "registrationNeutral" };
}

// ─── Email verification ───
export async function verifyEmailAction(token: unknown): Promise<FormResult> {
  if (!(await rateLimit(`verify:ip:${await ipKey()}`, 30, 900))) return { ok: false, error: "rateLimited" };
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return { ok: false, error: "verifyInvalid" };
  const res = await verifyEmail(token);
  if (!res.ok) return { ok: false, error: "verifyInvalid" };
  const state = await getSessionState();
  if (state.kind === "active") redirect(dashboardFor(state.actor.role));
  if (state.kind === "inactive" && state.userId === res.userId) redirect(statusRoute(state.status));
  return { ok: true, message: "verifyDone" };
}

export async function resendVerificationAction(): Promise<FormResult> {
  const state = await getSessionState();
  if (state.kind !== "inactive" || state.status !== "PENDING_VERIFICATION") return { ok: false, error: "genericError" };
  if (!(await rateLimit(`verify-resend:${state.userId}`, 3, 3600))) return { ok: false, error: "rateLimited" };
  if (!(await rateLimit(`verify-cooldown:${state.userId}`, 1, 60))) return { ok: false, error: "rateLimited" };
  await issueToken(state.userId, "EMAIL_VERIFICATION");
  return { ok: true, message: "verifyResent" };
}

// ─── Password reset ───
export async function forgotPasswordAction(input: unknown): Promise<FormResult> {
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error) };
  const { email } = parsed.data;
  if (!(await rateLimit(`forgot:ip:${await ipKey()}`, 10, 3600)) || !(await rateLimit(`forgot:email:${email}`, 3, 3600))) {
    return { ok: true, message: "forgotDone" };
  }
  const user = await db.user.findUnique({ where: { email }, select: { id: true, status: true } });
  // Same response whether or not the account exists (no account enumeration).
  if (user && user.status !== "REJECTED") {
    await issueToken(user.id, "PASSWORD_RESET");
    await audit({ actorId: user.id, action: "auth.password_reset_requested", entityType: "user", entityId: user.id });
  }
  return { ok: true, message: "forgotDone" };
}

export async function resetPasswordAction(input: unknown): Promise<FormResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error) };
  if (!(await rateLimit(`reset:ip:${await ipKey()}`, 10, 3600))) return { ok: false, error: "rateLimited" };
  const res = await resetPassword(parsed.data.token, parsed.data.password);
  if (!res.ok) return { ok: false, error: "resetInvalid" };
  await destroySession();
  return { ok: true, message: "resetDone" };
}

// ─── Status refresh (pending screen) ───
export async function refreshStatusAction(): Promise<FormResult> {
  const state = await getSessionState();
  if (state.kind === "active") redirect(dashboardFor(state.actor.role));
  if (state.kind === "inactive") {
    const target = statusRoute(state.status);
    if (target !== "/pending-approval") redirect(target);
    return { ok: true, message: "stillPending" };
  }
  redirect("/login");
}

export async function signOutAction(): Promise<void> {
  const state = await getSessionState();
  const revoked = await destroySession();
  if (revoked && state.kind === "active") {
    await audit({ actorId: state.actor.userId, actorRole: state.actor.role, action: "auth.logout", entityType: "session", entityId: state.actor.sessionId });
  } else if (revoked && state.kind === "inactive") {
    await audit({ actorId: state.userId, action: "auth.logout", entityType: "session" });
  }
  redirect("/login");
}
