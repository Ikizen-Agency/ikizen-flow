import type { ActivityRepository } from "../../activity/application/ports";
import type { CustomerRepository } from "../../customers/application/ports";
import type { Notify } from "../../notifications/application/use-cases";
import { NotFoundError, type Clock } from "../../shared-types";
import { computeSalesKpis, countByEffectiveStatus, onTimeDeliveryRate, weeklyBilledTotals } from "../domain/metrics";
import {
  assertOrderTransition,
  computeOrderTotals,
  dueDateFor,
  nextOrderReference,
  ORDER_STATUS_LABELS,
  type OrderCategory,
  type OrderStatus,
  type PaymentTerms,
} from "../domain/order";
import type { NewOrderItem, OrderListQuery, OrderRepository } from "./ports";

export interface SalesDeps {
  orders: OrderRepository;
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
  ({ orders, customers, activity, clock }: SalesDeps) =>
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
  ({ orders, activity, clock, notify }: Omit<SalesDeps, "customers">) =>
  async (reference: string, status: OrderStatus, actorId: number | null = null) => {
    const now = clock();
    const order = await orders.findByReference(reference);
    if (!order) throw new NotFoundError("Order", reference);
    assertOrderTransition(order.status, status);

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
