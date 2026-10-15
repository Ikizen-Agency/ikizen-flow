import { formatCompactMoney } from "@/shared/domain/money";
import { chartTicks } from "../../../dashboard/ui/components/chart-geometry";

export interface ChartSeries {
  key: string;
  label: string;
  /** CSS color, e.g. `var(--color-chart-1)`. */
  color: string;
  /** Legend value (e.g. the series total). */
  total?: string;
}

export interface GroupedBarPoint {
  label: string;
  values: ReadonlyArray<number>;
  displays: ReadonlyArray<string>;
}

export interface GroupedBarChartProps {
  id: string;
  title: string;
  series: ReadonlyArray<ChartSeries>;
  points: ReadonlyArray<GroupedBarPoint>;
  /** Tick formatter (money by default). */
  format?: "money" | "count";
}

const VIEW_W = 1000;
const VIEW_H = 100;
const MAX_X_LABELS = 12;

/**
 * Hand-rolled grouped bars (same approach as the dashboard trend chart): geometry in a stretched SVG,
 * axis labels in HTML, one `<title>` tooltip per group on a full-height hit target, a legend and an sr-only table.
 */
export function GroupedBarChart({ id, title, series, points, format = "money" }: GroupedBarChartProps) {
  const ticks = chartTicks(Math.max(0, ...points.flatMap((p) => p.values)));
  const max = ticks.at(-1) || 1;
  const slot = VIEW_W / Math.max(1, points.length);
  const groupW = slot * 0.7;
  const gap = Math.min(4, groupW * 0.05);
  const barW = (groupW - gap * (series.length - 1)) / series.length;
  const every = Math.ceil(points.length / MAX_X_LABELS);
  const tick = (v: number) => (format === "money" ? formatCompactMoney(v) : String(v));

  return (
    <figure className="m-0 flex flex-col gap-space-sm">
      <ul className="flex flex-wrap gap-space-md text-body-sm text-ink-muted" aria-label="Legend">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label}
            {s.total ? <span className="tabular font-semibold text-ink">{s.total}</span> : null}
          </li>
        ))}
      </ul>
      <div className="relative h-56 pt-2 pb-7 pl-12">
        {ticks.map((t) => (
          <span
            key={t}
            className="tabular absolute left-0 w-10 -translate-y-1/2 text-right text-label-sm text-ink-subtle"
            style={{ top: `calc(0.5rem + (100% - 2.25rem) * ${1 - t / max})` }}
            aria-hidden
          >
            {tick(t)}
          </span>
        ))}
        <div className="relative h-full">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" role="img" aria-labelledby={`${id}-title`}>
            <title id={`${id}-title`}>{title}</title>
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
            {points.map((p, i) => {
              const x0 = i * slot + (slot - groupW) / 2;
              return (
                <g key={p.label}>
                  {p.values.map((v, s) => {
                    const h = (v / max) * VIEW_H;
                    return <rect key={series[s]!.key} x={x0 + s * (barW + gap)} y={VIEW_H - h} width={barW} height={h} rx={2} fill={series[s]!.color} />;
                  })}
                  <rect x={i * slot} y={0} width={slot} height={VIEW_H} fill="transparent" className="hover:fill-ink/5">
                    <title>{`${p.label}: ${series.map((s, k) => `${s.label} ${p.displays[k]}`).join(", ")}`}</title>
                  </rect>
                </g>
              );
            })}
          </svg>
          <div className="absolute inset-x-0 -bottom-7 h-6" aria-hidden>
            {points.map((p, i) =>
              i % every === 0 ? (
                <span key={p.label} className="absolute -translate-x-1/2 text-label-sm whitespace-nowrap text-ink-subtle" style={{ left: `${((i + 0.5) / points.length) * 100}%` }}>
                  {p.label}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              {p.displays.map((d, k) => (
                <td key={series[k]!.key}>{d}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
