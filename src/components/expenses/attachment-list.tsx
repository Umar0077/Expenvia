"use client";

import { useTranslations } from "next-intl";
import { Download, Eye, FileText, ImageIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerAction } from "@/components/ui/use-action";
import { removeAttachmentAction } from "@/server/actions/expenses";

export interface AttachmentItem {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export function AttachmentList({ items, canRemove }: { items: AttachmentItem[]; canRemove?: boolean }) {
  const t = useTranslations("expenses");
  const remove = useServerAction(removeAttachmentAction);
  if (items.length === 0) return <p className="text-sm text-muted">{t("noAttachments")}</p>;
  return (
    <ul className="space-y-2">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm">
          {a.mimeType === "application/pdf" ? <FileText className="size-4 shrink-0 text-danger" /> : <ImageIcon className="size-4 shrink-0 text-info" />}
          <span className="min-w-0 flex-1 truncate" title={a.fileName}>{a.fileName}</span>
          <span className="tabular hidden text-xs text-muted sm:inline">{(a.sizeBytes / 1024).toFixed(0)} KB</span>
          <Button asChild variant="ghost" size="icon-sm" aria-label={`${t("preview")}: ${a.fileName}`}>
            <a href={`/api/files/receipt/${a.id}?inline=1`} target="_blank" rel="noopener noreferrer"><Eye /></a>
          </Button>
          <Button asChild variant="ghost" size="icon-sm" aria-label={`${t("download")}: ${a.fileName}`}>
            <a href={`/api/files/receipt/${a.id}`}><Download /></a>
          </Button>
          {canRemove && (
            <Button variant="ghost" size="icon-sm" className="text-muted hover:text-danger" disabled={remove.pending} onClick={() => remove.run({ id: a.id })} aria-label={t("removeFile", { name: a.fileName })}>
              <Trash2 />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
