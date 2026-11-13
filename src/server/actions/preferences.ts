"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { LOCALE_COOKIE, locales } from "@/i18n/config";
import { MOTION_COOKIE } from "@/lib/preferences";
import { getSessionState } from "@/server/auth/session";
import { db } from "@/server/db";

const ONE_YEAR = 60 * 60 * 24 * 365;
const cookieOpts = { path: "/", maxAge: ONE_YEAR, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };

export async function setLocaleAction(input: unknown): Promise<{ ok: boolean }> {
  const parsed = z.enum(locales).safeParse(input);
  if (!parsed.success) return { ok: false };
  (await cookies()).set(LOCALE_COOKIE, parsed.data, cookieOpts);
  await persist({ locale: parsed.data });
  return { ok: true };
}

export async function setMotionAction(input: unknown): Promise<{ ok: boolean }> {
  const parsed = z.enum(["full", "reduced", "system"]).safeParse(input);
  if (!parsed.success) return { ok: false };
  (await cookies()).set(MOTION_COOKIE, parsed.data, cookieOpts);
  await persist({ motion: parsed.data.toUpperCase() as "FULL" | "REDUCED" | "SYSTEM" });
  return { ok: true };
}

export async function setThemeAction(input: unknown): Promise<{ ok: boolean }> {
  const parsed = z.enum(["light", "dark", "system"]).safeParse(input);
  if (!parsed.success) return { ok: false };
  await persist({ theme: parsed.data.toUpperCase() as "LIGHT" | "DARK" | "SYSTEM" });
  return { ok: true };
}

async function persist(data: { locale?: "en" | "ur"; motion?: "FULL" | "REDUCED" | "SYSTEM"; theme?: "LIGHT" | "DARK" | "SYSTEM" }) {
  const state = await getSessionState();
  if (state.kind !== "active") return; // anonymous visitors: cookie/localStorage only
  await db.userPreference.upsert({
    where: { userId: state.actor.userId },
    create: { userId: state.actor.userId, ...data },
    update: data,
  });
}
