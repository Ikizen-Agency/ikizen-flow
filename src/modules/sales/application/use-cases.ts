import type { ActivityRepository } from "../../activity/application/ports";
import type { CustomerRepository } from "../../customers/application/ports";
import type { Notify } from "../../notifications/application/use-cases";
import { NotFoundError, type Clock } from "../../shared-types";
import { computeSalesKpis, countByEffectiveStatus, onTimeDeliveryRate, weeklyBilledTotals } from "../domain/metrics";
import {
  assertOrderDeletable,
  assertOrderEditable,
  assertOrderTransition,
  assertTotalCoversPayments,
  computeOrderTotals,
  dueDateFor,
  nextOrderReference,
  ORDER_HAS_PAYMENTS_DELETE_MESSAGE,
  ORDER_STATUS_LABELS,
  OrderNotDeletableError,
  type OrderCategory,
  type OrderStatus,
  type PaymentTerms,
} from "../domain/order";
import { assertPaymentAllowed, statusAfterPaymentRemoval, type PaymentMethod } from "../domain/payment";
import { formatMoney } from "@/shared/domain/money";
import type { NewOrderItem, OrderListQuery, OrderRepository, PaymentRepository } from "./ports";

export interface SalesDeps {
  orders: OrderRepository;
  payments: PaymentRepository;
  customers: CustomerRepository;
  activity: ActivityRepository;
  clock: Clock;
  /** Optional: in-app notifications (status changes notify the order's creator). */
  notify?: Notify;
}

export const makeListOrders =
  ({ orders, clock }: Pick<SalesDeps, "orders" | "clock">) =>
  (query: OrderListQuery = {}) =>
    orders.list({ page: 1, pageSize: 20, asOf: clock(), ...query });

export interface CreateOrderInput {
  customerId: number;
  title: string;
  description?: string | null;
  category: OrderCategory;
  paymentTerms: PaymentTerms;
  /** "draft" saves a draft; "pending" confirms the order. */
  status: Extract<OrderStatus, "draft" | "pending">;
  discountBps?: number;
  taxBps?: number;
  issueDate?: Date;
  items: NewOrderItem[];
}

export const makeCreateOrder =
  ({ orders, customers, activity, clock }: Omit<SalesDeps, "payments">) =>
  async (input: CreateOrderInput, actorId: number | null = null) => {
    const now = clock();
    const customer = await customers.findById(input.customerId);
    if (!customer) throw new NotFoundError("Customer", input.customerId);

    const totals = computeOrderTotals(input.items, { discountBps: input.discountBps, taxBps: input.taxBps });
    const issueDate = input.issueDate ?? now;
    const order = await orders.create(
      {
        reference: nextOrderReference(await orders.latestReference()),
        customerId: customer.id,
        title: input.title,
        description: input.description ?? null,
        category: input.category,
        status: input.status,
        paymentTerms: input.paymentTerms,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        taxCents: totals.taxCents,
        amountCents: totals.totalCents,
        issueDate,
        dueDate: dueDateFor(issueDate, input.paymentTerms),
        items: input.items,
      },
      now,
    );
    await customers.touch(customer.id, now);
    await activity.record({
      actorId,
      message: `${input.status === "draft" ? "drafted" : "created"} order #${order.reference} for ${customer.company}`,
      category: "billing",
      entityType: "order",
      entityId: order.id,
      createdAt: now,
    });
    return order;
  };

export const makeChangeOrderStatus =
  ({ orders, payments, activity, clock, notify }: Omit<SalesDeps, "customers">) =>
  async (reference: string, status: OrderStatus, actorId: number | null = null) => {
    const now = clock();
    const order = await orders.findByReference(reference);
    if (!order) throw new NotFoundError("Order", reference);
    assertOrderTransition(order.status, status);
    // "Mark as Paid" settles whatever is still due (re-read atomically), so payments always add up to a completed order's total.
    if (status === "completed") {
      await payments.settleBalance({ orderId: order.id, method: "other", paidAt: now, note: "Marked as paid", recordedById: actorId }, now);
    }

    const invoiceNumber =
      status === "invoiced" && !order.invoiceNumber ? `INV-${order.reference.replace("SL-", "")}` : order.invoiceNumber;
    await orders.updateStatus(order.id, {
      status,
      invoiceNumber,
      paidAt: status === "completed" ? now : order.paidAt,
      updatedAt: now,
    });
    await activity.record({
      actorId,
      message: `marked order #${order.reference} as ${ORDER_STATUS_LABELS[status]}`,
      category: "billing",
      entityType: "order",
      entityId: order.id,
      createdAt: now,
    });
    if (notify) {
      await notify({
        recipientIds: [await activity.originatorOf("order", order.id)],
        actorId,
        type: "order_status",
        title: `Order ${order.reference} is now ${ORDER_STATUS_LABELS[status]}`,
        body: `${order.customerCompany} · ${order.title}`,
        href: `/sales?order=${encodeURIComponent(order.reference)}`,
      });
    }
  };

export const makeGetOrder =
  ({ orders }: Pick<SalesDeps, "orders">) =>
  (reference: string) =>
    orders.findByReference(reference);

const VELOCITY_WEEKS = 6;

/** KPI tiles, register tab counts, delivery velocity and the latest active engagement. */
export const makeGetSalesOverview =
  ({ orders, clock }: Pick<SalesDeps, "orders" | "clock">) =>
  async () => {
    const now = clock();
    const [summaries, active, latestReference] = await Promise.all([
      orders.listSummaries(),
      orders.list({ status: "processing", asOf: now, page: 1, pageSize: 1 }),
      orders.latestReference(),
    ]);
    return {
      now,
      kpis: computeSalesKpis(summaries, now),
      counts: countByEffectiveStatus(summaries, now),
      onTimeRate: onTimeDeliveryRate(summaries),
      weekly: weeklyBilledTotals(summaries, now, VELOCITY_WEEKS),
      activeEngagement: active.items[0] ?? null,
      latestReference,
      nextReference: nextOrderReference(latestReference),
    };
  };

export interface UpdateOrderInput {
  customerId: number;
  category: OrderCategory;
  paymentTerms: PaymentTerms;
  discountBps?: number;
  taxBps?: number;
  description?: string | null;
  items: NewOrderItem[];
}

/** Reopens a draft or pending order in the composer: recomputes totals and the due date from its issue date. */
export const makeUpdateOrder =
  ({ orders, customers, activity, clock }: Omit<SalesDeps, "payments">) =>
  async (reference: string, input: UpdateOrderInput, actorId: number | null = null) => {
    const order = await orders.findByReference(reference);
    if (!order) throw new NotFoundError("Order", reference);
    assertOrderEditable(order);
    const customer = await customers.findById(input.customerId);
    if (!customer) throw new NotFoundError("Customer", input.customerId);
    const now = clock();
    const totals = computeOrderTotals(input.items, { discountBps: input.discountBps, taxBps: input.taxBps });
    assertTotalCoversPayments(order.reference, totals.totalCents, order.paidCents);
    await orders.update(order.id, {
      customerId: customer.id,
      title: input.items[0]?.title ?? order.title,
      description: input.description === undefined ? order.description : input.description,
      category: input.category,
      paymentTerms: input.paymentTerms,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      taxCents: totals.taxCents,
      amountCents: totals.totalCents,
      dueDate: dueDateFor(order.issueDate, input.paymentTerms),
      items: input.items,
      updatedAt: now,
    });
    await customers.touch(customer.id, now);
    await activity.record({
      actorId,
      message: `updated order #${order.reference} for ${customer.company}`,
      category: "billing",
      entityType: "order",
      entityId: order.id,
      createdAt: now,
    });
    return { reference: order.reference };
  };

/** Deletes an unpaid draft or cancelled order (items cascade); orders with recorded payments are never deleted. */
export const makeDeleteOrder =
  ({ orders, activity, clock }: Pick<SalesDeps, "orders" | "activity" | "clock">) =>
  async (reference: string, actorId: number | null = null) => {
    const order = await orders.findByReference(reference);
    if (!order) throw new NotFoundError("Order", reference);
    assertOrderDeletable(order);
    // The repository re-checks payments atomically: one recorded after the check above still blocks the delete.
    if (!(await orders.delete(order.id))) throw new OrderNotDeletableError(order.reference, order.status, ORDER_HAS_PAYMENTS_DELETE_MESSAGE);
    await activity.record({
      actorId,
      message: `deleted ${ORDER_STATUS_LABELS[order.status].toLowerCase()} order #${order.reference} for ${order.customerCompany}`,
      category: "billing",
      entityType: "order",
      entityId: order.id,
      createdAt: clock(),
    });
  };

export interface RecordPaymentInput {
  amountCents: number;
  method: PaymentMethod;
  /** When the money arrived (defaults to now). */
  paidAt?: Date;
  reference?: string | null;
  note?: string | null;
}

/** Records a (partial) payment; a fully paid order moves to completed with `paidAt` of the settling payment. */
export const makeRecordPayment =
  ({ orders, payments, activity, clock, notify }: Omit<SalesDeps, "customers">) =>
  async (reference: string, input: RecordPaymentInput, actorId: number | null = null) => {
    const order = await orders.findByReference(reference);
    if (!order) throw new NotFoundError("Order", reference);
    // Fail fast on the snapshot; the repository re-checks status and balance inside its transaction.
    assertPaymentAllowed(order, input.amountCents);
    const now = clock();
    const paidAt = input.paidAt ?? now;
    const { payment, paidCents, completed } = await payments.record(
      { orderId: order.id, amountCents: input.amountCents, method: input.method, paidAt, reference: input.reference ?? null, note: input.note ?? null, recordedById: actorId },
      now,
    );
    await activity.record({
      actorId,
      message: `recorded a ${formatMoney(input.amountCents)} payment on order #${order.reference}${completed ? " (paid in full)" : ""}`,
      category: "billing",
      entityType: "order",
      entityId: order.id,
      createdAt: now,
    });
    if (notify) {
      await notify({
        recipientIds: [await activity.originatorOf("order", order.id)],
        actorId,
        type: "payment_received",
        title: `Payment of ${formatMoney(input.amountCents)} received for ${order.reference}`,
        body: completed ? `${order.customerCompany} · paid in full` : `${order.customerCompany} · ${formatMoney(order.amountCents - paidCents)} still due`,
        href: `/sales?order=${encodeURIComponent(order.reference)}`,
      });
    }
    return { payment, completed };
  };

/** Removes a payment; a completed order that is no longer fully paid goes back to invoiced. */
export const makeDeletePayment =
  ({ orders, payments, activity, clock }: Pick<SalesDeps, "orders" | "payments" | "activity" | "clock">) =>
  async (paymentId: number, actorId: number | null = null) => {
    const payment = await payments.findById(paymentId);
    if (!payment) throw new NotFoundError("Payment", paymentId);
    const order = await orders.findById(payment.orderId);
    if (!order) throw new NotFoundError("Order", payment.orderId);
    await payments.delete(payment.id);
    const now = clock();
    const next = statusAfterPaymentRemoval(order.status, order.amountCents, order.paidCents - payment.amountCents);
    if (next) await orders.updateStatus(order.id, { status: next, invoiceNumber: order.invoiceNumber, paidAt: null, updatedAt: now });
    await activity.record({
      actorId,
      message: `removed a ${formatMoney(payment.amountCents)} payment from order #${order.reference}${next ? " (reopened as invoiced)" : ""}`,
      category: "billing",
      entityType: "order",
      entityId: order.id,
      createdAt: now,
    });
    return { reference: order.reference };
  };

export const makeListPayments =
  ({ payments }: Pick<SalesDeps, "payments">) =>
  (orderId: number) =>
    payments.listForOrder(orderId);
