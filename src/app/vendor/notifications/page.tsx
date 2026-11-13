import { NotificationsView } from "@/components/account/notifications-view";
import { requireActor } from "@/server/auth/session";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor("VENDOR");
  return <NotificationsView actor={actor} sp={await searchParams} />;
}
