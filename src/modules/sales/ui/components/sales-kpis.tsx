import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";

export interface SalesKpi {
  label: string;
  value: string;
  caption: string;
  chip?: { icon: string; label: string; tone: "accent" | "success" | "danger" };
  /** 0..1 fill of the bottom progress bar. */
  progress: number;
  barTone: "accent" | "success";
}

const chipTones = {
  accent: "bg-accent-tint text-accent",
  success: "bg-success-tint text-success-strong",
  danger: "bg-danger-tint text-danger-strong",
};

export function SalesKpis({ items }: { items: ReadonlyArray<SalesKpi> }) {
  return (
    <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
      {items.map((kpi) => (
        <Card key={kpi.label} className="flex flex-col gap-space-md">
          <div className="flex items-start justify-between gap-space-sm">
            <p className="text-label-sm tracking-[0.08em] text-ink-subtle uppercase">{kpi.label}</p>
            {kpi.chip ? (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm", chipTones[kpi.chip.tone])}>
                <Icon name={kpi.chip.icon} size={14} />
                {kpi.chip.label}
              </span>
            ) : null}
          </div>
          <div>
            <p className="tabular text-data-metric text-ink">{kpi.value}</p>
            <p className="mt-1 text-body-sm text-ink-subtle">{kpi.caption}</p>
          </div>
          <div
            className="mt-auto h-1.5 overflow-hidden rounded-full bg-well"
            role="progressbar"
            aria-label={`${kpi.label} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(kpi.progress * 100)}
          >
            <div
              className={cn("h-full rounded-full", kpi.barTone === "accent" ? "bg-accent" : "bg-success")}
              style={{ width: `${Math.round(Math.min(1, Math.max(0, kpi.progress)) * 100)}%` }}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
