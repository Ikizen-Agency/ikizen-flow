import type { ReactNode } from "react";
import { Card } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";

export interface ReportSectionProps {
  id: string;
  title: string;
  description?: ReactNode;
  /** CSV download for this section. */
  exportHref: string;
  className?: string;
  children: ReactNode;
}

/** Report card: title, caption, CSV export button and content. */
export function ReportSection({ id, title, description, exportHref, className, children }: ReportSectionProps) {
  return (
    <Card className={`flex flex-col gap-space-md ${className ?? ""}`} aria-labelledby={`${id}-heading`}>
      <div className="flex items-start justify-between gap-space-md">
        <div className="min-w-0">
          <h2 id={`${id}-heading`} className="text-headline-sm text-ink">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-body-sm text-ink-subtle">{description}</p> : null}
        </div>
        <a
          href={exportHref}
          download
          title={`Export ${title} as CSV`}
          aria-label={`Export ${title} as CSV`}
          className="shrink-0 rounded-control bg-surface-container-low p-2 text-ink-muted hover:bg-surface-container hover:text-ink"
        >
          <Icon name="file_download" size={18} />
        </a>
      </div>
      {children}
    </Card>
  );
}

export interface BarListRow {
  key: string;
  label: ReactNode;
  value: number;
  display: string;
  /** Secondary text under the label. */
  detail?: string;
}

/** Horizontal single-hue bars (magnitude), values and labels in ink tokens. */
export function BarList({ rows, empty }: { rows: ReadonlyArray<BarListRow>; empty: string }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (rows.length === 0 || max === 0) return <p className="rounded-control bg-surface-container-low p-3 text-body-sm text-ink-subtle">{empty}</p>;
  return (
    <ul className="flex flex-col gap-space-sm">
      {rows.map((r) => (
        <li key={r.key} title={`${typeof r.label === "string" ? r.label : r.key}: ${r.display}`}>
          <div className="flex items-baseline justify-between gap-space-sm text-body-sm">
            <span className="min-w-0 truncate text-ink">{r.label}</span>
            <span className="tabular shrink-0 font-semibold text-ink">{r.display}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-well" aria-hidden>
            <div className="h-full rounded-full bg-chart-1" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          {r.detail ? <p className="mt-0.5 text-body-sm text-ink-subtle">{r.detail}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/** Small labelled figure for section summaries. */
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-body-sm text-ink-subtle">{label}</dt>
      <dd className="tabular mt-0.5 text-headline-sm text-ink">{value}</dd>
    </div>
  );
}
