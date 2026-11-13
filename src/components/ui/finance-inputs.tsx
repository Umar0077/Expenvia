"use client";

import { forwardRef, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { FileText, ImageIcon, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useField } from "@/components/ui/form";
import { duration, ease } from "@/lib/motion";

/** ExpenviaCurrencyInput — text input (decimal string), LTR digits, currency affix. */
export const CurrencyInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { currency: string }>(function CurrencyInput(
  { currency, className, ...props },
  ref,
) {
  const f = useField();
  return (
    <div className="relative" dir="ltr">
      <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">{currency}</span>
      <input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        id={f?.id}
        aria-describedby={f?.describedBy}
        aria-invalid={f?.invalid || undefined}
        {...props}
        className={cn(
          "tabular h-11 w-full rounded-[var(--radius-md)] border border-border bg-surface ps-14 pe-3.5 text-end text-body font-medium shadow-[var(--shadow-card)]",
          "hover:border-border-strong focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/15 aria-[invalid=true]:border-danger",
          className,
        )}
      />
    </div>
  );
});

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const MAX = 5 * 1024 * 1024;

/** ExpenviaFileUpload — drag & drop with client-side pre-checks (server re-validates by magic bytes). */
export function FileUpload({ files, onChange, max = 5, existing = 0 }: { files: File[]; onChange: (f: File[]) => void; max?: number; existing?: number }) {
  const t = useTranslations("expenses");
  const tv = useTranslations("validation");
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string>();

  const add = (list: FileList | null) => {
    if (!list) return;
    setError(undefined);
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!ACCEPT.split(",").includes(f.type)) {
        setError(tv("fileType"));
        continue;
      }
      if (f.size > MAX) {
        setError(tv("fileSize"));
        continue;
      }
      if (next.length + existing >= max) break;
      next.push(f);
    }
    onChange(next);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        disabled={files.length + existing >= max}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed px-4 py-7 text-center transition-colors duration-150 disabled:opacity-50",
          drag ? "border-brand bg-brand-soft/50" : "border-border-strong/70 bg-surface-2/40 hover:border-brand/60 hover:bg-brand-soft/30",
        )}
      >
        <motion.span animate={drag ? { y: -3, scale: 1.05 } : { y: 0, scale: 1 }} transition={{ duration: duration.micro }}>
          <UploadCloud className="size-7 text-brand" />
        </motion.span>
        <span className="text-sm font-medium">{t("dropFiles")}</span>
        <span className="text-xs text-muted">{t("receiptsHint")}</span>
      </button>
      <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <ul className="mt-2 space-y-1.5">
        <AnimatePresence initial={false}>
          {files.map((f, i) => (
            <motion.li
              key={`${f.name}-${f.size}-${i}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: duration.standard, ease: ease.out }}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm"
            >
              {f.type === "application/pdf" ? <FileText className="size-4 text-danger" /> : <ImageIcon className="size-4 text-info" />}
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="tabular text-xs text-muted">{(f.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={t("removeFile", { name: f.name })} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-danger">
                <X className="size-4" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
