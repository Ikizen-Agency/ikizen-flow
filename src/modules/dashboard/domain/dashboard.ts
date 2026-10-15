/**
 * Pure aggregations behind the overview dashboard. Calendar math is UTC (see `@/shared/domain/time`);
 * money is integer cents.
 */
import type { Cents } from "@/shared/domain/money";
import { percentChange } from "@/shared/domain/stats";
import { addDays, startOfDay } from "@/shared/domain/time";
import { isBillable } from "../../sales/domain/metrics";
import { ORDER_CATEGORIES, type OrderCategory, type OrderStatus } from "../../sales/domain/order";
import { taskDueState, type TaskPriority, type TaskStatus } from "../../tasks/domain/task";

/** Order projection the dashboard aggregates over. */
export interface OrderFact {
  id: number;
  customerId: number;
  category: OrderCategory;
  status: OrderStatus;
  amountCents: Cents;
  issueDate: Date;
  dueDate: Date;
  paidAt: Date | null;
}

export const DASHBOARD_PERIODS = ["month", "quarter", "year"] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export interface PeriodRange {
  start: Date;
  end: Date;
  /** Same elapsed span at the start of the previous period, for like-for-like comparisons. */
  previousStart: Date;
  previousEnd: Date;
  label: string;
  comparison: string;
}

const monthStart = (year: number, month: number) => new Date(Date.UTC(year, month, 1));
const dayLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

export function periodRange(period: DashboardPeriod, now: Date): PeriodRange {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const spec = {
    month: { start: monthStart(y, m), previousStart: monthStart(y, m - 1), next: monthStart(y, m + 1), name: "This Month", unit: "month" },
    quarter: {
      start: monthStart(y, m - (m % 3)),
      previousStart: monthStart(y, m - (m % 3) - 3),
      next: monthStart(y, m - (m % 3) + 3),
      name: "This Quarter",
      unit: "quarter",
    },
    year: { start: monthStart(y, 0), previousStart: monthStart(y - 1, 0), next: null, name: "Year to Date", unit: "year" },
  }[period];
  const lastDay = spec.next ? addDays(spec.next, -1) : now;
  return {
    start: spec.start,
    end: now,
    previousStart: spec.previousStart,
    previousEnd: new Date(spec.previousStart.getTime() + (now.getTime() - spec.start.getTime())),
    label: `${spec.name} (${dayLabel.format(spec.start)} - ${dayLabel.format(lastDay)})`,
    comparison: `vs last ${spec.unit}`,
  };
}

const billedIn = (orders: ReadonlyArray<OrderFact>, from: Date, to: Date) =>
  orders.filter((o) => isBillable(o.status) && o.issueDate >= from && o.issueDate < to);

const sum = (orders: ReadonlyArray<OrderFact>) => orders.reduce((total, o) => total + o.amountCents, 0);

export function totalSales(orders: ReadonlyArray<OrderFact>, range: PeriodRange) {
  const cents = sum(billedIn(orders, range.start, range.end));
  const previousCents = sum(billedIn(orders, range.previousStart, range.previousEnd));
  return { cents, previousCents, change: percentChange(cents, previousCents) };
}

export type TrendMetric = "gross" | "collected";

export interface TrendPoint {
  label: string;
  cents: Cents;
  /** The month that contains `now` (partial). */
  current: boolean;
}

/** Monthly gross billings (by issue date) or collected cash (by payment date), oldest month first. */
export function revenueTrend(orders: ReadonlyArray<OrderFact>, now: Date, metric: TrendMetric, months = 6) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const points: TrendPoint[] = Array.from({ length: months }, (_, i) => {
    const from = monthStart(y, m - (months - 1 - i));
    const to = monthStart(y, m - (months - 2 - i));
    const cents =
      metric === "gross"
        ? sum(billedIn(orders, from, to))
        : sum(orders.filter((o) => o.paidAt !== null && o.paidAt >= from && o.paidAt < to));
    return { label: monthLabel.format(from), cents, current: i === months - 1 };
  });
  const peakIndex = points.reduce((best, p, i) => (p.cents > (points[best]?.cents ?? 0) ? i : best), 0);
  return { points, peakIndex };
}

/** Annualized from the average of the last three complete months. */
export function projectedRunRateCents(points: ReadonlyArray<TrendPoint>): Cents {
  const complete = points.filter((p) => !p.current).slice(-3);
  if (complete.length === 0) return 0;
  return Math.round((complete.reduce((total, p) => total + p.cents, 0) / complete.length) * 12);
}

/** Largest-remainder rounding: whole percentages that add up to exactly 100 (or all zero). */
export function roundedShares(values: ReadonlyArray<number>): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const floors = raw.map(Math.floor);
  let remaining = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remaining <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    remaining -= 1;
  }
  return floors;
}

export interface CategoryRevenue {
  category: OrderCategory;
  cents: Cents;
  percent: number;
  orders: number;
  customers: number;
}

export function revenueByCategory(orders: ReadonlyArray<OrderFact>, range: Pick<PeriodRange, "start" | "end">) {
  const billed = billedIn(orders, range.start, range.end);
  const rows = ORDER_CATEGORIES.map((category) => {
    const inCategory = billed.filter((o) => o.category === category);
    return { category, cents: sum(inCategory), orders: inCategory.length, customers: new Set(inCategory.map((o) => o.customerId)).size };
  });
  const shares = roundedShares(rows.map((r) => r.cents));
  const categories: CategoryRevenue[] = rows.map((r, i) => ({ ...r, percent: shares[i] ?? 0 })).sort((a, b) => b.cents - a.cents);
  return { totalCents: sum(billed), categories };
}

const DUE_SOON_DAYS = 14;

/** Unpaid invoices (overdue included) and how many fall due within the next two weeks. */
export function outstandingInvoices(orders: ReadonlyArray<OrderFact>, now: Date) {
  const invoiced = orders.filter((o) => o.status === "invoiced");
  const soonLimit = addDays(now, DUE_SOON_DAYS);
  return {
    cents: sum(invoiced),
    count: invoiced.length,
    dueSoon: invoiced.filter((o) => o.dueDate >= startOfDay(now) && o.dueDate <= soonLimit).length,
  };
}

interface DashboardTask {
  id: number;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: Date | null;
}

export function attentionTasks(tasks: ReadonlyArray<DashboardTask>, now: Date) {
  let overdue = 0;
  let dueToday = 0;
  for (const t of tasks) {
    const state = taskDueState(t, now);
    if (state === "overdue") overdue += 1;
    else if (state === "today") dueToday += 1;
  }
  return { total: overdue + dueToday, overdue, dueToday };
}

/** Open tasks due by the end of tomorrow (overdue first), soonest first. */
export function criticalTasks<T extends DashboardTask>(tasks: ReadonlyArray<T>, now: Date, limit: number) {
  const horizon = addDays(startOfDay(now), 2);
  const due = tasks
    .filter((t): t is T & { dueAt: Date } => t.status !== "completed" && t.dueAt !== null && t.dueAt < horizon)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  return { items: due.slice(0, limit), dueToday: due.filter((t) => taskDueState(t, now) === "today").length };
}

export function greetingFor(now: Date, timeZone?: string): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(now));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
