import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

const tones: Record<BadgeTone, { badge: string; dot: string }> = {
  success: { badge: "bg-success-tint text-success-strong border-success-line", dot: "bg-success" },
  warning: { badge: "bg-warning-tint text-warning-strong border-warning-line", dot: "bg-warning" },
  danger: { badge: "bg-danger-tint text-danger-strong border-danger-line", dot: "bg-danger" },
  neutral: { badge: "bg-well text-neutral-strong border-line", dot: "bg-ink-subtle" },
  info: { badge: "bg-accent-tint text-accent border-primary-fixed", dot: "bg-accent" },
};

export interface BadgeProps {
  tone?: BadgeTone;
  /** Shows a leading status dot. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = "neutral", dot = false, className, children }: BadgeProps) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-badge border px-2 py-0.5 text-label-sm whitespace-nowrap",
        t.badge,
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", t.dot)} aria-hidden /> : null}
      {children}
    </span>
  );
}
