import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui/icon";

export interface TaskKpiStripProps {
  completion: string;
  velocity: string;
  blockedHours: number;
  milestone: { title: string; when: string } | null;
}

function Tile({ label, icon, iconClass, children }: { label: string; icon: string; iconClass: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-space-md rounded-card border border-line bg-card p-space-md shadow-level-1">
      <div className="min-w-0">
        <p className="text-label-sm tracking-[0.08em] text-ink-subtle uppercase">{label}</p>
        <div className="mt-1">{children}</div>
      </div>
      <span className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-card", iconClass)}>
        <Icon name={icon} size={22} />
      </span>
    </div>
  );
}

/** Operational KPI mini strip under the board. */
export function TaskKpiStrip({ completion, velocity, blockedHours, milestone }: TaskKpiStripProps) {
  return (
    <section aria-label="Operational metrics" className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
      <Tile label="Sprint Completion" icon="trending_up" iconClass="bg-success-tint text-success">
        <p className="tabular text-data-metric text-ink">{completion}</p>
      </Tile>
      <Tile label="Avg Velocity" icon="speed" iconClass="bg-accent-tint text-accent">
        <p className="tabular text-data-metric text-ink">
          {velocity} <span className="text-label-sm font-normal text-ink-subtle">tasks/wk</span>
        </p>
      </Tile>
      <Tile label="Blocked Time" icon="timer_off" iconClass="bg-danger-tint text-danger">
        <p className="tabular text-data-metric text-danger-strong">
          {blockedHours} <span className="text-label-sm font-normal text-ink-subtle">hrs</span>
        </p>
      </Tile>
      <Tile label="Next Milestone" icon="flag" iconClass="bg-warning-tint text-warning">
        {milestone ? (
          <>
            <p className="truncate text-headline-sm text-ink" title={milestone.title}>
              {milestone.title}
            </p>
            <p className="text-body-sm text-ink-subtle">{milestone.when}</p>
          </>
        ) : (
          <p className="text-headline-sm text-ink-subtle">No upcoming deadlines</p>
        )}
      </Tile>
    </section>
  );
}
