import Link from "next/link";
import { formatCompactMoney } from "@/shared/domain/money";
import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ui/card";
import { chartTicks, monotonePath, plotPoints } from "./chart-geometry";

export interface TrendChartPoint {
  label: string;
  /** Amount in cents. */
  value: number;
  /** Formatted value, e.g. "$24,850". */
  display: string;
}

export interface RevenueTrendCardProps {
  badge: string;
  subtitle: string;
  metricLabel: string;
  points: ReadonlyArray<TrendChartPoint>;
  peakIndex: number;
  toggles: ReadonlyArray<{ label: string; href: string; active: boolean }>;
  highlights: ReadonlyArray<{ label: string; value: string; tone?: "success" | "accent" }>;
}

const VIEW_W = 600;
const VIEW_H = 100;
const BAR_RATIO = 0.3;

/**
 * Six-month revenue chart: one hue for the series (line + soft area), neutral monthly bars, the peak
 * emphasised. Geometry is drawn in a stretched SVG; dots and labels are HTML so they stay crisp at any width.
 */
function TrendChart({ points, peakIndex, metricLabel, ticks }: { points: ReadonlyArray<TrendChartPoint>; peakIndex: number; metricLabel: string; ticks: number[] }) {
  const max = ticks.at(-1) ?? 1;
  const plotted = plotPoints(
    points.map((p) => p.value),
    max,
  );
  // Inset x so the first and last bars are not clipped.
  const inset = (x: number) => 6 + x * 0.88;
  const coords = plotted.map((p) => ({ x: inset(p.x), y: p.y }));
  const toView = (p: { x: number; y: number }) => ({ x: (p.x / 100) * VIEW_W, y: (p.y / 100) * VIEW_H });
  const line = monotonePath(coords.map(toView));
  const first = coords[0] ? toView(coords[0]) : null;
  const last = coords.at(-1) ? toView(coords.at(-1)!) : null;
  const area = first && last ? `${line} L ${last.x} ${VIEW_H} L ${first.x} ${VIEW_H} Z` : "";
  const slot = points.length > 1 ? (VIEW_W * 0.88) / (points.length - 1) : VIEW_W;
  const barW = slot * BAR_RATIO;
  const summary = points.map((p) => `${p.label}: ${p.display}`).join(", ");

  return (
    <figure className="m-0">
      <div className="relative h-60 pt-2 pb-7 pl-10">
        {ticks.map((t) => (
          <span
            key={t}
            className="tabular absolute left-0 w-8 -translate-y-1/2 text-right text-label-sm text-ink-subtle"
            style={{ top: `calc(0.5rem + (100% - 2.25rem) * ${1 - t / max})` }}
            aria-hidden
          >
            {formatCompactMoney(t)}
          </span>
        ))}
        <div className="relative h-full">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" role="img" aria-labelledby="trend-title trend-desc">
            <title id="trend-title">{`${metricLabel} by month`}</title>
            <desc id="trend-desc">{summary}</desc>
            <defs>
              <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <line
                key={t}
                x1={0}
                x2={VIEW_W}
                y1={VIEW_H * (1 - t / max)}
                y2={VIEW_H * (1 - t / max)}
                stroke="var(--color-line)"
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : "4 4"}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {coords.map((c, i) => {
              const p = toView(c);
              return (
                <rect
                  key={points[i]!.label}
                  x={p.x - barW / 2}
                  y={p.y}
                  width={barW}
                  height={Math.max(0, VIEW_H - p.y)}
                  rx={3}
                  fill={i === peakIndex ? "var(--color-primary-fixed)" : "var(--color-surface-container-low)"}
                />
              );
            })}
            <path d={area} fill="url(#trend-fill)" />
            <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {coords.map((c, i) => {
            const peak = i === peakIndex;
            const point = points[i]!;
            return (
              <span
                key={point.label}
                title={`${point.label}: ${point.display}`}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
                  peak ? "size-3 border-card bg-accent shadow-level-1" : "size-2 border-accent bg-card",
                )}
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
                aria-hidden
              />
            );
          })}
          {points[peakIndex] && points[peakIndex].value > 0 ? (
            <span
              className="tabular absolute -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-control bg-inverse-surface px-1.5 py-0.5 text-label-sm whitespace-nowrap text-inverse-on-surface"
              style={{ left: `${coords[peakIndex]!.x}%`, top: `${coords[peakIndex]!.y}%` }}
            >
              {points[peakIndex].display}
            </span>
          ) : null}
          <div className="absolute inset-x-0 -bottom-7 h-6" aria-hidden>
            {coords.map((c, i) => (
              <span
                key={points[i]!.label}
                className={cn("absolute -translate-x-1/2 text-label-sm whitespace-nowrap", i === peakIndex ? "font-semibold text-ink" : "text-ink-subtle")}
                style={{ left: `${c.x}%` }}
              >
                {points[i]!.label}
                {i === peakIndex ? " (Peak)" : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>{`${metricLabel} by month`}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              <td>{p.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const HIGHLIGHT_TONE = { success: "text-success-strong", accent: "text-accent" } as const;

export function RevenueTrendCard({ badge, subtitle, metricLabel, points, peakIndex, toggles, highlights }: RevenueTrendCardProps) {
  const ticks = chartTicks(Math.max(0, ...points.map((p) => p.value)));
  return (
    <Card className="flex flex-col gap-space-md" aria-labelledby="revenue-trend-title">
      <div className="flex flex-col justify-between gap-space-md sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="revenue-trend-title" className="text-headline-md text-ink">
              Revenue &amp; Sales Trend
            </h2>
            <span className="rounded-badge bg-surface-container-low px-2 py-0.5 text-label-sm text-accent">{badge}</span>
          </div>
          <p className="mt-0.5 text-body-sm text-ink-subtle">{subtitle}</p>
        </div>
        <nav aria-label="Chart metric" className="inline-flex shrink-0 self-start rounded-control bg-surface-container-low p-1">
          {toggles.map((t) => (
            <Link
              key={t.label}
              href={t.href}
              scroll={false}
              aria-current={t.active ? "true" : undefined}
              className={cn(
                "rounded-control px-3 py-1 text-label-sm transition-colors",
                t.active ? "bg-card text-ink shadow-level-1" : "text-ink-subtle hover:text-ink",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      <TrendChart points={points} peakIndex={peakIndex} metricLabel={metricLabel} ticks={ticks} />
      <dl className="mt-space-sm grid grid-cols-1 gap-space-md border-t border-line-soft pt-space-md sm:grid-cols-3">
        {highlights.map((h) => (
          <div key={h.label}>
            <dt className="text-body-sm text-ink-subtle">{h.label}</dt>
            <dd className={cn("tabular mt-0.5 text-headline-sm", h.tone ? HIGHLIGHT_TONE[h.tone] : "text-ink")}>{h.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
