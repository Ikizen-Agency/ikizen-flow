import { cn } from "@/shared/lib/cn";
import { Card, CardHeader } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";

export interface CategoryRow {
  key: string;
  label: string;
  detail: string;
  amount: string;
  percent: number;
}

/** Fixed category order -> fixed hue, so a category keeps its colour across periods. */
const HUES = ["bg-accent", "bg-success", "bg-tertiary"] as const;
const TEXT = ["text-accent", "text-success-strong", "text-tertiary"] as const;

export function CategoryCard({ rows, hueIndex }: { rows: ReadonlyArray<CategoryRow>; hueIndex: Record<string, number> }) {
  const empty = rows.every((r) => r.percent === 0);
  return (
    <Card className="flex flex-col gap-space-md" aria-labelledby="category-title">
      <CardHeader
        title={<span id="category-title">Revenue by Category</span>}
        description="Breakdown across current deliverables"
        action={<Icon name="pie_chart" size={20} className="text-ink-subtle" />}
      />
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-container" role="img" aria-label={rows.map((r) => `${r.label} ${r.percent}%`).join(", ")}>
        {rows.map((r) =>
          r.percent > 0 ? <div key={r.key} className={HUES[hueIndex[r.key] ?? 0]} style={{ width: `${r.percent}%` }} title={`${r.label} (${r.percent}%)`} /> : null,
        )}
      </div>
      {empty ? <p className="text-body-sm text-ink-subtle">No billable revenue in this period yet.</p> : null}
      <ul className="flex flex-col gap-space-md">
        {rows.map((r) => (
          <li key={r.key} className="flex items-start justify-between gap-space-sm">
            <div className="flex min-w-0 items-start gap-space-sm">
              <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", HUES[hueIndex[r.key] ?? 0])} aria-hidden />
              <div className="min-w-0">
                <p className="text-label-md text-ink">{r.label}</p>
                <p className="text-body-sm text-ink-subtle">{r.detail}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="tabular text-label-md text-ink">{r.amount}</p>
              <p className={cn("tabular text-label-sm", TEXT[hueIndex[r.key] ?? 0])}>{r.percent}%</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
