export function AuthHeading({ title, body, icon }: { title: string; body?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-8">
      {icon && <div className="mb-5">{icon}</div>}
      <h1 className="font-display text-[1.75rem] font-semibold tracking-[-0.02em] text-text">{title}</h1>
      {body && <p className="mt-2 text-body leading-relaxed text-muted">{body}</p>}
    </div>
  );
}

export function IconBadge({ children, tone = "brand" }: { children: React.ReactNode; tone?: "brand" | "warning" | "danger" }) {
  const cls = { brand: "bg-brand-soft text-brand", warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger" }[tone];
  return <span className={`grid size-12 place-items-center rounded-[var(--radius-lg)] ${cls} [&_svg]:size-6`}>{children}</span>;
}
