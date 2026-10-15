import { applyBasisPoints, type Cents } from "@/shared/domain/money";
import { addDays, daysBetween } from "@/shared/domain/time";

export const ORDER_STATUSES = ["draft", "pending", "processing", "invoiced", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
/** Status as displayed: a stored status, or "overdue" derived from the due date. */
export type EffectiveOrderStatus = OrderStatus | "overdue";

export const ORDER_STATUS_LABELS: Record<EffectiveOrderStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  processing: "Processing",
  invoiced: "Invoiced",
  completed: "Completed",
  cancelled: "Cancelled",
  overdue: "Overdue",
};

export const ORDER_CATEGORIES = ["custom_software", "ux_ui_retainer", "cloud_architecture"] as const;
export type OrderCategory = (typeof ORDER_CATEGORIES)[number];

export const ORDER_CATEGORY_LABELS: Record<OrderCategory, string> = {
  custom_software: "Custom Software Dev",
  ux_ui_retainer: "UX/UI Retainers",
  cloud_architecture: "Cloud Architecture",
};

export const PAYMENT_TERMS = ["net_30", "due_on_receipt", "net_15", "deposit_milestone"] as const;
export type PaymentTerms = (typeof PAYMENT_TERMS)[number];

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  net_30: "Net 30 Days",
  due_on_receipt: "Due On Receipt",
  net_15: "Net 15 Days",
  deposit_milestone: "50% Deposit / 50% Milestone Completion",
};

const PAYMENT_TERMS_DAYS: Record<PaymentTerms, number> = {
  net_30: 30,
  due_on_receipt: 0,
  net_15: 15,
  deposit_milestone: 30,
};

const TRANSITIONS: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
  draft: ["pending", "cancelled"],
  pending: ["processing", "invoiced", "cancelled"],
  processing: ["invoiced", "completed", "cancelled"],
  invoiced: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** Statuses where money is still expected to come in. */
export const OPEN_ORDER_STATUSES: ReadonlyArray<OrderStatus> = ["pending", "processing", "invoiced"];

export class InvalidOrderTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(`Cannot move an order from "${from}" to "${to}".`);
    this.name = "InvalidOrderTransitionError";
  }
}

export function allowedOrderTransitions(from: OrderStatus): ReadonlyArray<OrderStatus> {
  return TRANSITIONS[from];
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) throw new InvalidOrderTransitionError(from, to);
}

interface DueOrder {
  status: OrderStatus;
  dueDate: Date;
}

export function daysOverdue(order: DueOrder, now: Date): number {
  if (!OPEN_ORDER_STATUSES.includes(order.status)) return 0;
  return Math.max(0, daysBetween(order.dueDate, now));
}

export function effectiveOrderStatus(order: DueOrder, now: Date): EffectiveOrderStatus {
  return daysOverdue(order, now) > 0 ? "overdue" : order.status;
}

export function dueDateFor(issueDate: Date, terms: PaymentTerms): Date {
  return addDays(issueDate, PAYMENT_TERMS_DAYS[terms]);
}

export interface PricedLine {
  quantity: number;
  unitRateCents: Cents;
}

export interface OrderTotals {
  subtotalCents: Cents;
  discountCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
}

/** Subtotal of line items, minus an early settlement discount, plus tax on the discounted amount. */
export function computeOrderTotals(
  lines: ReadonlyArray<PricedLine>,
  options: { discountBps?: number; taxBps?: number } = {},
): OrderTotals {
  const { discountBps = 0, taxBps = 0 } = options;
  const subtotalCents = lines.reduce((sum, line) => {
    if (line.quantity < 0 || line.unitRateCents < 0) throw new RangeError("Line quantity and rate must be non-negative.");
    return sum + Math.round(line.quantity * line.unitRateCents);
  }, 0);
  const discountCents = applyBasisPoints(subtotalCents, discountBps);
  const taxCents = applyBasisPoints(subtotalCents - discountCents, taxBps);
  return { subtotalCents, discountCents, taxCents, totalCents: subtotalCents - discountCents + taxCents };
}

const REFERENCE_PREFIX = "SL-";

export function nextOrderReference(latest: string | null): string {
  const n = latest ? Number(latest.replace(REFERENCE_PREFIX, "")) : 1000;
  return `${REFERENCE_PREFIX}${(Number.isFinite(n) ? n : 1000) + 1}`;
}
