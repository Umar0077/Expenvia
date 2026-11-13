import { cn } from "@/lib/cn";

/**
 * Official Expenvia logo artwork (supplied by the product owner):
 *   public/brand/expenvia-logo-light.png — dark wordmark, for light theme
 *   public/brand/expenvia-logo-dark.png  — ivory wordmark, for dark theme
 * Both are rendered; CSS shows the one matching the theme class on <html>,
 * so the correct logo appears on first paint with no theme flash.
 */
const LIGHT_SRC = "/brand/expenvia-logo-light.png";
const DARK_SRC = "/brand/expenvia-logo-dark.png";
// Trimmed artwork ratio (≈ 769×157, transparent, no padding).
const RATIO = 4.9;

function ThemedImg({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LIGHT_SRC} alt="Expenvia" width={769} height={156} draggable={false} className={cn("block dark:hidden", className)} style={style} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={DARK_SRC} alt="Expenvia" width={769} height={159} draggable={false} className={cn("hidden dark:block", className)} style={style} />
    </>
  );
}

/** Full logo (symbol + wordmark). `height` is the visible artwork height in px. */
export function ExpenviaLogo({
  className,
  height = 28,
  showWordmark = true,
  size,
}: {
  className?: string;
  height?: number;
  showWordmark?: boolean;
  size?: "navigation" | "sidebar" | "auth" | "footer";
}) {
  if (!showWordmark) return <ExpenviaMark className={className} size={height} />;
  return (
    <span className={cn("brand-logo inline-flex shrink-0 items-center", size && `brand-logo-${size}`, className)} dir="ltr">
      <ThemedImg className="max-w-none object-contain" style={size ? { width: "100%", height: "auto" } : { height, width: height * RATIO }} />
    </span>
  );
}

/**
 * Symbol only (collapsed sidebar, compact spots). Uses the official standalone
 * symbol artwork (public/brand/expenvia-mark.png, same file as the favicon);
 * its green/copper colors read well on both themes, so one file serves both.
 */
export function ExpenviaMark({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/expenvia-mark.png"
      alt="Expenvia"
      draggable={false}
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
