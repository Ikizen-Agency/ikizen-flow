import { Card } from "@/shared/ui/card";

export interface VelocityCardProps {
  onTimeLabel: string | null;
  engagement: { title: string; subtitle: string } | null;
  weekly: ReadonlyArray<{ label: string; value: number; display: string }>;
  totalLabel: string;
}

const W = 120;
const H = 32;
const PAD = 4;

/** Single-series sparkline: 2px line, one hue, emphasised latest point, values exposed as text. */
function Sparkline({ points }: { points: VelocityCardProps["weekly"] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const step = points.length > 1 ? (W - 2 * PAD) / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({ x: PAD + i * step, y: H - PAD - (p.value / max) * (H - 2 * PAD), p }));
  const last = coords.at(-1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Weekly billings: ${points.map((p) => `${p.label} ${p.display}`).join(", ")}`} className="overflow-visible text-success">
      <polyline points={coords.map((c) => `${c.x},${c.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c) => (
        <circle key={c.p.label} cx={c.x} cy={c.y} r={6} fill="transparent">
          <title>{`${c.p.label}: ${c.p.display}`}</title>
        </circle>
      ))}
      {last ? <circle cx={last.x} cy={last.y} r={3} fill="currentColor" stroke="var(--color-card)" strokeWidth={2} /> : null}
    </svg>
  );
}

export function VelocityCard({ onTimeLabel, engagement, weekly, totalLabel }: VelocityCardProps) {
  return (
    <Card className="flex flex-col gap-space-md" aria-labelledby="velocity-title">
      <div className="flex items-start justify-between gap-space-md">
        <h2 id="velocity-title" className="text-headline-md text-ink">
          Client Relationship Velocity
        </h2>
        {onTimeLabel ? <p className="text-right text-label-sm text-success-strong">{onTimeLabel} On-time delivery</p> : null}
      </div>
      <div className="relative flex h-40 items-end overflow-hidden rounded-card bg-linear-to-br from-primary via-accent to-on-primary-fixed-variant p-space-md">
        <div aria-hidden className="absolute -top-10 -right-10 size-40 rounded-full bg-white/10" />
        <div aria-hidden className="absolute top-6 right-16 size-16 rounded-full bg-white/10" />
        <div className="relative">
          <p className="text-headline-sm text-white">{engagement ? engagement.title : "No active engagement"}</p>
          <p className="text-body-sm text-white/80">{engagement ? engagement.subtitle : "Orders in processing will appear here."}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-space-md rounded-control bg-surface-container-low p-space-sm">
        <div>
          <p className="text-body-sm text-ink-subtle">Trailing 6-Week Velocity</p>
          <p className="text-headline-sm text-ink">{totalLabel} invoiced</p>
        </div>
        <Sparkline points={weekly} />
      </div>
    </Card>
  );
}
