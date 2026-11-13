import { forwardRef } from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  [
    "ui-button inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium",
    "rounded-[var(--radius-md)] transition-[background-color,border-color,color,box-shadow,transform] duration-150",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-fg shadow-[var(--shadow-card)] hover:bg-brand-hover",
        secondary: "border border-border bg-surface text-text hover:border-border-strong hover:bg-surface-2",
        ghost: "text-muted hover:bg-surface-2 hover:text-text",
        subtle: "bg-brand-soft text-brand hover:bg-brand-soft/70",
        danger: "bg-danger text-white hover:bg-danger/90",
        link: "h-auto px-0 text-brand underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-body",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/** ExpenviaButton */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      data-size={size ?? "md"}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});
