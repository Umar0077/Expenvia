import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import type { Role } from "@/generated/prisma/enums";
import { generateToken, hashToken } from "./tokens";

export const SESSION_COOKIE = "expenvia_session";
const TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 12);
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface Actor {
  sessionId: string;
  userId: string;
  role: Role;
  fullName: string;
  email: string;
}

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const h = await headers();
  const expiresAt = new Date(Date.now() + TTL_HOURS * 3600 * 1000);
  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      ipAddress: clientIp(h),
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  if (!token) return null;
  const s = await db.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return s.count > 0 ? token : null;
}

export type SessionState =
  | { kind: "none" }
  | { kind: "expired" }
  | { kind: "inactive"; status: string; userId: string }
  | { kind: "active"; actor: Actor };

/** Resolves the current session once per request. */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { kind: "none" };

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, role: true, status: true, fullName: true, email: true } } },
  });
  if (!session || session.revokedAt) return { kind: "none" };
  if (session.expiresAt <= new Date()) return { kind: "expired" };

  const { user } = session;
  if (user.status !== "ACTIVE" || !user.role) {
    return { kind: "inactive", status: user.status, userId: user.id };
  }

  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }

  return {
    kind: "active",
    actor: { sessionId: session.id, userId: user.id, role: user.role, fullName: user.fullName, email: user.email },
  };
});

/** Use in every protected page / action. Redirects instead of rendering anything sensitive. */
export async function requireActor(...roles: Role[]): Promise<Actor> {
  const state = await getSessionState();
  switch (state.kind) {
    case "none":
      redirect("/login");
    case "expired":
      redirect("/session-expired");
    case "inactive":
      redirect(statusRoute(state.status));
    case "active":
      if (roles.length > 0 && !roles.includes(state.actor.role)) redirect("/unauthorized");
      return state.actor;
  }
}

export function statusRoute(status: string): string {
  switch (status) {
    case "PENDING_VERIFICATION":
      return "/verify-email";
    case "PENDING_APPROVAL":
    case "INFO_REQUESTED":
      return "/pending-approval";
    case "REJECTED":
      return "/registration-rejected";
    case "SUSPENDED":
      return "/account-suspended";
    default:
      return "/login";
  }
}

export function dashboardFor(role: Role): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin/dashboard";
    case "VENDOR":
      return "/vendor/dashboard";
    case "USER":
      return "/user/dashboard";
  }
}

export function clientIp(h: Headers): string | null {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

/** Super Admin: revoke all sessions of a user (e.g. on suspension). */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const r = await db.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
  return r.count;
}
