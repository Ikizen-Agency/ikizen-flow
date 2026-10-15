import type { Cents } from "@/shared/domain/money";
import { OPEN_ORDER_STATUSES, type OrderStatus } from "./order";

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
