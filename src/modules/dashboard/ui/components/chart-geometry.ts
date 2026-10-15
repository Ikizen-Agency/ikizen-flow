/** Geometry helpers for the hand-rolled SVG trend chart. Coordinates live in a 0..100 box. */

export interface PlotPoint {
  x: number;
  y: number;
}

const NICE_STEPS = [1, 2, 2.5, 5, 10];

/** Four ticks from 0 with a "nice" step, so the top tick sits just above `max`. */
export function chartTicks(max: number, intervals = 3): number[] {
  const rough = max > 0 ? max / intervals : 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = (NICE_STEPS.find((s) => s * magnitude >= rough) ?? 10) * magnitude;
  return Array.from({ length: intervals + 1 }, (_, i) => i * step);
}

export function plotPoints(values: ReadonlyArray<number>, max: number): PlotPoint[] {
  const n = values.length;
  return values.map((v, i) => ({
    x: n === 1 ? 50 : (i / (n - 1)) * 100,
    y: 100 - (max > 0 ? (v / max) * 100 : 0),
  }));
}

const fmt = (n: number) => String(Number(n.toFixed(2)));

/** Monotone cubic (Fritsch-Carlson) path: smooth, passes through every point, never overshoots. */
export function monotonePath(points: ReadonlyArray<PlotPoint>): string {
  if (points.length === 0) return "";
  const first = points[0]!;
  if (points.length === 1) return `M ${fmt(first.x)} ${fmt(first.y)}`;

  const n = points.length;
  const slopes = points.slice(0, -1).map((p, i) => {
    const next = points[i + 1]!;
    return (next.y - p.y) / (next.x - p.x || 1);
  });
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0]!;
    if (i === n - 1) return slopes[n - 2]!;
    const before = slopes[i - 1]!;
    const after = slopes[i]!;
    return before * after <= 0 ? 0 : (before + after) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    const d = slopes[i]!;
    if (d === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i]! / d;
    const b = tangents[i + 1]! / d;
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangents[i] = t * a * d;
      tangents[i + 1] = t * b * d;
    }
  }

  let path = `M ${fmt(first.x)} ${fmt(first.y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p = points[i]!;
    const q = points[i + 1]!;
    const third = (q.x - p.x) / 3;
    path += ` C ${fmt(p.x + third)} ${fmt(p.y + tangents[i]! * third)}, ${fmt(q.x - third)} ${fmt(q.y - tangents[i + 1]! * third)}, ${fmt(q.x)} ${fmt(q.y)}`;
  }
  return path;
}
