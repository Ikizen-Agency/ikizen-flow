import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Icon } from "./icon";

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon = "inbox", title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-space-sm px-space-lg py-12 text-center", className)}>
      <span className="mb-space-xs inline-flex size-12 items-center justify-center rounded-card bg-accent-tint text-accent">
        <Icon name={icon} size={24} />
      </span>
      <h2 className="text-headline-sm text-ink">{title}</h2>
      {description ? <p className="max-w-md text-body-md text-ink-subtle">{description}</p> : null}
      {action ? <div className="mt-space-sm">{action}</div> : null}
    </div>
  );
}
