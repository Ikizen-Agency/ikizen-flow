import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui/icon";
import { KpiTile } from "@/shared/ui/kpi-tile";
import { monotonePath, plotPoints } from "./chart-geometry";

type ChipTone = "success" | "danger" | "warning" | "info";

const CHIP: Record<ChipTone, string> = {
  success: "bg-success-tint text-success-strong",
  danger: "bg-danger-tint text-danger-strong",
  warning: "bg-warning-tint text-warning-strong",
  info: "bg-accent-tint text-accent",
};

function Chip({ tone, icon, children }: { tone: ChipTone; icon?: string; children: ReactNode }) {
  return (
    <span className={cn("tabular inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-label-sm", CHIP[tone])}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}

function Footer({ chip, note, aside }: { chip: ReactNode; note: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-space-sm">
      <div className="flex min-w-0 items-center gap-space-sm">
        {chip}
        <span className="text-body-sm text-ink-subtle">{note}</span>
      </div>
      {aside}
    </div>
  );
}

const SPARK_W = 64;
const SPARK_H = 24;

/** Six-month gross revenue micro-trend; values are exposed through the accessible label. */
function Sparkline({ points }: { points: ReadonlyArray<{ label: string; value: number; display: string }> }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const path = monotonePath(plotPoints(points.map((p) => p.value), max).map((p) => ({ x: (p.x / 100) * SPARK_W, y: 2 + (p.y / 100) * (SPARK_H - 4) })));
  return (
    <svg
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      width={SPARK_W}
      height={SPARK_H}
      role="img"
      aria-label={`Monthly sales: ${points.map((p) => `${p.label} ${p.display}`).join(", ")}`}
      className="shrink-0 overflow-visible text-success"
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface KpiCardsProps {
  sales: { value: string; change: { label: string; positive: boolean } | null; comparison: string; sparkline: ReadonlyArray<{ label: string; value: number; display: string }> };
  outstanding: { value: string; dueSoon: number };
  customers: { active: number; newThisMonth: number };
  attention: { total: number; overdue: number; dueToday: number };
}

export function KpiCards({ sales, outstanding, customers, attention }: KpiCardsProps) {
  return (
    <section aria-label="Key metrics" className="grid grid-cols-1 gap-gutter sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        label="Total Sales"
        value={sales.value}
        icon="payments"
        footer={
          <Footer
            chip={
              sales.change ? (
                <Chip tone={sales.change.positive ? "success" : "danger"} icon={sales.change.positive ? "trending_up" : "trending_down"}>
                  {sales.change.label}
                </Chip>
              ) : (
                <Chip tone="info">New</Chip>
              )
            }
            note={sales.comparison}
            aside={<Sparkline points={sales.sparkline} />}
          />
        }
      />
      <KpiTile
        label="Outstanding Invoices"
        value={outstanding.value}
        icon="pending_actions"
        tone="warning"
        footer={<Footer chip={<Chip tone="warning" icon="schedule">{outstanding.dueSoon} pending</Chip>} note="Due within 14 days" />}
      />
      <KpiTile
        label="Active Customers"
        value={customers.active.toLocaleString("en-US")}
        icon="corporate_fare"
        footer={
          <Footer
            chip={
              <Chip tone="info" icon="person_add">
                +{customers.newThisMonth} account{customers.newThisMonth === 1 ? "" : "s"}
              </Chip>
            }
            note="this calendar month"
          />
        }
      />
      <KpiTile
        label="Attention Needed"
        value={`${attention.total} Task${attention.total === 1 ? "" : "s"}`}
        icon="priority_high"
        tone="danger"
        footer={<Footer chip={<Chip tone="danger">{attention.overdue} overdue</Chip>} note={`${attention.dueToday} due by end of day`} />}
      />
    </section>
  );
}
