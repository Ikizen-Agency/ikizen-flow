import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Removes the default 20px padding (e.g. for edge-to-edge tables). */
  flush?: boolean;
  as?: "section" | "div" | "article";
}

/** Level 1 surface: white, 1px slate border, 12px radius, faint ambient shadow. */
export function Card({ flush = false, as: Tag = "section", className, ...rest }: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-card border border-line bg-card shadow-level-1",
        flush ? "overflow-hidden" : "p-5",
        className,
      )}
      {...rest}
    />
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-space-md", className)}>
      <div className="min-w-0">
        <h2 className="text-headline-sm text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-body-sm text-ink-subtle">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
