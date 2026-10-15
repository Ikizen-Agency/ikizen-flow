import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Icon } from "./icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "destructive-solid";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-space-xs whitespace-nowrap rounded-control text-label-md transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white shadow-level-1 hover:bg-accent-hover active:bg-accent-active",
  secondary:
    "border border-line bg-card text-ink-muted hover:border-line-strong hover:bg-canvas hover:text-ink",
  ghost: "bg-transparent text-ink-muted hover:bg-well hover:text-ink",
  destructive: "border border-danger-border bg-danger-tint text-danger hover:bg-danger hover:text-white",
  "destructive-solid": "bg-danger text-white hover:bg-danger-strong",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-space-sm",
  md: "h-9 px-space-md",
  lg: "h-10 px-space-md",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Class string for button-looking elements (use it on `<Link>` / `<a>`). */
export function buttonClasses({ variant = "primary", size = "md", className }: ButtonStyleOptions = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleOptions {
  icon?: string;
  trailingIcon?: string;
  children?: ReactNode;
}

export function Button({
  variant,
  size,
  className,
  icon,
  trailingIcon,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClasses({ variant, size, className })} {...rest}>
      {icon ? <Icon name={icon} size={18} /> : null}
      {children}
      {trailingIcon ? <Icon name={trailingIcon} size={18} /> : null}
    </button>
  );
}
