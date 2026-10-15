import type { Cents } from "@/shared/domain/money";
import { percentChange, ratio } from "@/shared/domain/stats";
import { addDays, daysBetween } from "@/shared/domain/time";
import { effectiveOrderStatus, OPEN_ORDER_STATUSES, ORDER_STATUSES, type EffectiveOrderStatus, type OrderStatus } from "./order";

/** Lightweight order projection used for KPI aggregation. */
export interface OrderSummary {
  id: number;
  customerId: number;
  status: OrderStatus;
  amountCents: Cents;
  issueDate: Date;
  dueDate: Date;
  paidAt: Date | null;
}

/** Orders that represent committed revenue (drafts and cancellations excluded). */
export function isBillable(status: OrderStatus): boolean {
  return status !== "draft" && status !== "cancelled";
}

export function isOpen(status: OrderStatus): boolean {
  return OPEN_ORDER_STATUSES.includes(status);
}

/** Amount still expected to come in from pending, processing and invoiced orders. */
export function openPipelineCents(orders: ReadonlyArray<OrderSummary>): Cents {
  return orders.reduce((sum, o) => (isOpen(o.status) ? sum + o.amountCents : sum), 0);
}

/** Billable amount issued within the half-open window [from, to). */
export function billedBetween(orders: ReadonlyArray<OrderSummary>, from: Date, to: Date): Cents {
  return orders.reduce(
    (sum, o) => (isBillable(o.status) && o.issueDate >= from && o.issueDate < to ? sum + o.amountCents : sum),
    0,
  );
}

/** Probability that an open order turns into cash, by stage. */
const STAGE_WEIGHTS: Partial<Record<OrderStatus, number>> = { pending: 0.5, processing: 0.75, invoiced: 0.9 };

export function weightedPipelineCents(orders: ReadonlyArray<OrderSummary>): Cents {
  return Math.round(orders.reduce((sum, o) => sum + o.amountCents * (STAGE_WEIGHTS[o.status] ?? 0), 0));
}

const CONVERTED: ReadonlyArray<OrderStatus> = ["processing", "invoiced", "completed"];

export interface SalesKpis {
  periodSalesCents: Cents;
  priorPeriodSalesCents: Cents;
  salesChange: number | null;
  pipelineCents: Cents;
  weightedPipelineCents: Cents;
  activeCount: number;
  averageDealCents: Cents;
  averageDealChange: number | null;
  /** Completed orders issued in the current window. */
  executedCount: number;
  conversionRate: number;
}

function averageCompleted(orders: ReadonlyArray<OrderSummary>, from: Date, to: Date) {
  const done = orders.filter((o) => o.status === "completed" && o.issueDate >= from && o.issueDate < to);
  const total = done.reduce((sum, o) => sum + o.amountCents, 0);
  return { count: done.length, average: done.length ? Math.round(total / done.length) : 0 };
}

/** Header KPIs of the sales screen over a trailing window compared with the window before it. */
export function computeSalesKpis(orders: ReadonlyArray<OrderSummary>, now: Date, windowDays = 30): SalesKpis {
  const start = addDays(now, -windowDays);
  const priorStart = addDays(start, -windowDays);
  const periodSalesCents = billedBetween(orders, start, now);
  const priorPeriodSalesCents = billedBetween(orders, priorStart, start);
  const current = averageCompleted(orders, start, now);
  const prior = averageCompleted(orders, priorStart, start);
  const nonDraft = orders.filter((o) => o.status !== "draft");
  return {
    periodSalesCents,
    priorPeriodSalesCents,
    salesChange: percentChange(periodSalesCents, priorPeriodSalesCents),
    pipelineCents: openPipelineCents(orders),
    weightedPipelineCents: weightedPipelineCents(orders),
    activeCount: orders.filter((o) => isOpen(o.status)).length,
    averageDealCents: current.average,
    averageDealChange: percentChange(current.average, prior.average),
    executedCount: current.count,
    conversionRate: ratio(nonDraft.filter((o) => CONVERTED.includes(o.status)).length, nonDraft.length),
  };
}

/** Share of paid orders settled on or before their due date; null when nothing has been paid. */
export function onTimeDeliveryRate(orders: ReadonlyArray<OrderSummary>): number | null {
  const paid = orders.filter((o): o is OrderSummary & { paidAt: Date } => o.paidAt !== null);
  if (paid.length === 0) return null;
  return paid.filter((o) => daysBetween(o.dueDate, o.paidAt) <= 0).length / paid.length;
}

/** Billable totals for the trailing `weeks` 7-day windows ending at `now`, oldest first. */
export function weeklyBilledTotals(orders: ReadonlyArray<OrderSummary>, now: Date, weeks = 6): Cents[] {
  return Array.from({ length: weeks }, (_, i) => {
    const to = addDays(now, -7 * (weeks - 1 - i));
    return billedBetween(orders, addDays(to, -7), to);
  });
}

export type EffectiveStatusCounts = Record<EffectiveOrderStatus | "all", number>;

export function countByEffectiveStatus(orders: ReadonlyArray<OrderSummary>, now: Date): EffectiveStatusCounts {
  const counts = Object.fromEntries([...ORDER_STATUSES, "overdue", "all"].map((s) => [s, 0])) as EffectiveStatusCounts;
  for (const o of orders) {
    counts[effectiveOrderStatus(o, now)] += 1;
    counts.all += 1;
  }
  return counts;
}
