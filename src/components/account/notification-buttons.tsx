"use client";

import { Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerAction } from "@/components/ui/use-action";
import { markNotificationsReadAction } from "@/server/actions/account";

export function MarkAllReadButton({ label }: { label: string }) {
  const a = useServerAction(markNotificationsReadAction);
  return <Button variant="secondary" disabled={a.pending} onClick={() => a.run({})}><CheckCheck /> {label}</Button>;
}

export function MarkReadButton({ id, label }: { id: string; label: string }) {
  const a = useServerAction(markNotificationsReadAction);
  return <Button variant="ghost" size="icon-sm" disabled={a.pending} onClick={() => a.run({ ids: [id] })} aria-label={label} title={label}><Check /></Button>;
}
