import { AppShell } from "@/components/shell/app-shell";
import { requireActor } from "@/server/auth/session";
import type { Role } from "@/generated/prisma/enums";
import { db } from "@/server/db";

/** Shared server layout for /admin, /user, /vendor. Pages re-check access themselves. */
export async function RoleLayout({ role, children }: { role: Role; children: React.ReactNode }) {
  const actor = await requireActor(role);
  const unread = await db.notification.count({ where: { userId: actor.userId, readAt: null } });
  return (
    <AppShell user={{ fullName: actor.fullName, email: actor.email, role: actor.role }} unread={unread}>
      {children}
    </AppShell>
  );
}
