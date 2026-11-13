"use client";

import { forwardRef, useId, useState, createContext, useContext } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

const control =
  "ui-control w-full rounded-[var(--radius-md)] border border-border bg-surface px-3.5 text-body text-text shadow-[var(--shadow-card)] " +
  "placeholder:text-muted/70 transition-[border-color,box-shadow] duration-150 " +
  "hover:border-border-strong focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/15 " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15";

// ── Field: wires label, hint and error to the control via context ──
interface FieldCtx {
  id: string;
  describedBy?: string;
  invalid: boolean;
}
const FieldContext = createContext<FieldCtx | null>(null);
export const useField = () => useContext(FieldContext);

/**
 * Field. `error` is a translation key from the "validation" namespace (or a
 * literal already-translated string when `errorIsText`).
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const tv = useTranslations("validation");
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const message = error ? (tv.has(error as never) ? tv(error as never) : error) : undefined;
  return (
    <FieldContext.Provider value={{ id, describedBy: [errId, hintId].filter(Boolean).join(" ") || undefined, invalid: !!error }}>
      <div className={cn("space-y-1.5", className)}>
        <label htmlFor={id} className="block text-sm font-medium text-text">
          {label}
          {required && (
            <span aria-hidden className="ms-0.5 text-copper">
              *
            </span>
          )}
        </label>
        {children}
        {message ? (
          <p id={errId} role="alert" className="flex items-center gap-1.5 text-sm text-danger">
            <AlertCircle className="size-3.5 shrink-0" /> {message}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-xs text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

function useControlProps(props: React.AriaAttributes & { id?: string }) {
  const f = useField();
  return {
    id: props.id ?? f?.id,
    "aria-describedby": props["aria-describedby"] ?? f?.describedBy,
    "aria-invalid": props["aria-invalid"] ?? (f?.invalid || undefined),
  };
}

/** ExpenviaInput */
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  const a = useControlProps(props);
  return <input ref={ref} {...props} {...a} className={cn(control, "h-11", className)} />;
});

/** ExpenviaTextarea */
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  const a = useControlProps(props);
  return <textarea ref={ref} rows={3} {...props} {...a} className={cn(control, "min-h-24 py-2.5 leading-relaxed", className)} />;
});

/** ExpenviaSelect — native select for full keyboard/screen-reader/mobile support. */
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  const a = useControlProps(props);
  return (
    <div className="relative">
      <select ref={ref} {...props} {...a} className={cn(control, "h-11 appearance-none pe-10", className)}>
        {children}
      </select>
      <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted">
        <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
});

export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function PasswordInput({ className, ...props }, ref) {
  const t = useTranslations("auth");
  const [show, setShow] = useState(false);
  const a = useControlProps(props);
  return (
    <div className="relative">
      <input ref={ref} {...props} {...a} type={show ? "text" : "password"} dir="ltr" className={cn(control, "h-11 pe-11 text-start", className)} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t("hidePassword") : t("showPassword")}
        aria-pressed={show}
        className="absolute end-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-[var(--radius-sm)] text-muted hover:bg-surface-2 hover:text-text"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});

export function Checkbox({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; error?: string }) {
  const id = useId();
  const tv = useTranslations("validation");
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-muted">
        <input
          id={id}
          type="checkbox"
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className="mt-1 size-4 shrink-0 cursor-pointer rounded border-border-strong accent-[var(--brand)]"
          {...props}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-danger">
          <AlertCircle className="size-3.5" /> {tv.has(error as never) ? tv(error as never) : error}
        </p>
      )}
    </div>
  );
}

const ALERT = {
  info: { cls: "border-info/25 bg-info-soft text-info", icon: Info },
  success: { cls: "border-success/25 bg-success-soft text-success", icon: CheckCircle2 },
  warning: { cls: "border-warning/25 bg-warning-soft text-warning", icon: TriangleAlert },
  danger: { cls: "border-danger/25 bg-danger-soft text-danger", icon: AlertCircle },
} as const;

export function Alert({ tone = "info", children, className }: { tone?: keyof typeof ALERT; children: React.ReactNode; className?: string }) {
  const { cls, icon: Icon } = ALERT[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-2.5 rounded-[var(--radius-md)] border px-3.5 py-3 text-sm leading-relaxed", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 text-text/90">{children}</div>
    </div>
  );
}
