import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Card } from "./card";
import { Icon } from "./icon";

export type KpiTone = "accent" | "success" | "warning" | "danger" | "neutral";

const iconTones: Record<KpiTone, string> = {
  accent: "bg-accent-tint text-accent",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
  neutral: "bg-well text-ink-muted",
};

export interface KpiTileProps {
  label: string;
  value: ReactNode;
  icon?: string;
  tone?: KpiTone;
  /** Inline micro-trend badge or note next to the label. */
  trend?: ReactNode;
  /** Footer content: comparisons, progress bars, sparklines. */
  footer?: ReactNode;
  className?: string;
}

export function KpiTile({ label, value, icon, tone = "accent", trend, footer, className }: KpiTileProps) {
  return (
    <Card className={cn("flex flex-col gap-space-md", className)}>
      <div className="flex items-start justify-between gap-space-sm">
        <div className="flex flex-wrap items-center gap-space-sm">
          <p className="text-label-sm tracking-[0.08em] text-ink-subtle uppercase">{label}</p>
          {trend}
        </div>
        {icon ? (
          <span className={cn("inline-flex size-9 items-center justify-center rounded-control", iconTones[tone])}>
            <Icon name={icon} size={20} />
          </span>
        ) : null}
      </div>
      <p className="tabular text-data-metric text-ink">{value}</p>
      {footer ? <div className="border-t border-line-soft pt-space-sm text-body-sm text-ink-subtle">{footer}</div> : null}
    </Card>
  );
}
