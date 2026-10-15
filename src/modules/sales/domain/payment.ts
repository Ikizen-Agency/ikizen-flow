import { formatMoney } from "@/shared/domain/money";
import { canTransitionOrder, OPEN_ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "./order";

export const PAYMENT_METHODS = ["card", "bank_transfer", "cash", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "Card",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
};

export interface PayableOrder {
  status: OrderStatus;
  amountCents: number;
  /** Sum of the payments recorded so far. */
  paidCents: number;
}

/** Amount still due: total minus recorded payments (never negative). */
export function orderBalance({ amountCents, paidCents }: Pick<PayableOrder, "amountCents" | "paidCents">): number {
  return Math.max(0, amountCents - paidCents);
}

export class PaymentRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentRejectedError";
  }
}

/** Payments are taken on open orders (pending, processing, invoiced; overdue included), in whole cents, up to the balance. */
export function assertPaymentAllowed(order: PayableOrder, amountCents: number): void {
  if (!OPEN_ORDER_STATUSES.includes(order.status)) {
    throw new PaymentRejectedError(`Payments cannot be recorded on a ${ORDER_STATUS_LABELS[order.status].toLowerCase()} order.`);
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new PaymentRejectedError("The payment amount must be a positive amount in cents.");
  const balance = orderBalance(order);
  if (amountCents > balance) {
    throw new PaymentRejectedError(`The payment of ${formatMoney(amountCents)} exceeds the outstanding balance of ${formatMoney(balance)}.`);
  }
}

/** "completed" once the order is fully paid and the lifecycle allows completing it; otherwise no change. */
export function statusAfterPayment(status: OrderStatus, amountCents: number, paidCents: number): OrderStatus | null {
  return paidCents >= amountCents && canTransitionOrder(status, "completed") ? "completed" : null;
}

/**
 * Correction after a payment is deleted: a completed order that is no longer fully paid goes back to "invoiced".
 * This deliberately bypasses the forward-only lifecycle, because the completion itself was derived from payments.
 */
export function statusAfterPaymentRemoval(status: OrderStatus, amountCents: number, paidCents: number): OrderStatus | null {
  return status === "completed" && paidCents < amountCents ? "invoiced" : null;
}
