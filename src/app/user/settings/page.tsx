import { SettingsView } from "@/components/account/settings-view";
import { requireActor } from "@/server/auth/session";

export default async function SettingsPage() {
  const actor = await requireActor("USER");
  return <SettingsView actor={actor} />;
}
