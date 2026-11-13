import { SettingsView } from "@/components/account/settings-view";
import { requireActor } from "@/server/auth/session";

export default async function SettingsPage() {
  const actor = await requireActor("SUPER_ADMIN");
  return <SettingsView actor={actor} />;
}
