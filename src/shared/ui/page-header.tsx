import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface PageHeaderProps {
  title: ReactNode;
  /** Small uppercase overline, e.g. "Executive cockpit". */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Inline badges next to the title (counts, deltas). */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, eyebrow, description, meta, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-space-md md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 flex items-center gap-2 text-label-sm tracking-[0.08em] text-ink-subtle uppercase">
            <span className="size-1.5 rounded-full bg-success" aria-hidden />
            {eyebrow}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-space-sm">
          <h1 className="text-headline-lg text-ink md:text-display-lg">{title}</h1>
          {meta}
        </div>
        {description ? <p className="mt-1 max-w-2xl text-body-md text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-space-sm">{actions}</div> : null}
    </header>
  );
}
