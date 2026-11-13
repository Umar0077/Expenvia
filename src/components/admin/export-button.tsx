"use client";

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Exports respect the current filters; the server re-checks permissions and audits the export. */
export function ExportButton({ report, query = "" }: { report: string; query?: string }) {
  const t = useTranslations("common");
  return (
    <Button asChild variant="secondary">
      <a href={`/api/export/${report}${query ? `?${query}` : ""}`} download>
        <Download /> {t("export")} CSV
      </a>
    </Button>
  );
}
