import type { ActivityRepository } from "../../activity/application/ports";
import type { CustomerRepository } from "../../customers/application/ports";
import { invoiceEmail } from "../../invoices/domain/invoice";
import type { NewOutboxEmail } from "../../mail/application/ports";
import type { OutboxEmail } from "../../mail/domain/email";
import type { Notify } from "../../notifications/application/use-cases";
import type { OrderRepository } from "../../sales/application/ports";
import { onTimeDeliveryRate } from "../../sales/domain/metrics";
import { daysOverdue, effectiveOrderStatus, type OrderCategory } from "../../sales/domain/order";
import { orderBalance } from "../../sales/domain/payment";
import { NotFoundError, type Clock } from "../../shared-types";
import type { TaskRepository } from "../../tasks/application/ports";
import {
  attentionTasks,
  criticalTasks,
  outstandingInvoices,
  periodRange,
  projectedRunRateCents,
  revenueByCategory,
  revenueTrend,
  totalSales,
  type DashboardPeriod,
  type TrendMetric,
} from "../domain/dashboard";
import type { DashboardRepository } from "./ports";

export interface DashboardDeps {
  dashboard: DashboardRepository;
  orders: OrderRepository;
  customers: CustomerRepository;
  tasks: TaskRepository;
  activity: ActivityRepository;
  clock: Clock;
}

const TREND_MONTHS = 6;
const CRITICAL_TASK_LIMIT = 3;
const RECENT_ORDER_LIMIT = 4;
const ACTIVITY_LIMIT = 4;
const OVERDUE_CARD_LIMIT = 2;
const OVERDUE_SCAN_LIMIT = 100;

/** Filters popover: category and customer narrow order widgets; customer and assignee narrow task widgets. */
export interface DashboardFilters {
  category?: OrderCategory;
  customerId?: number;
  assigneeId?: number;
}

export interface DashboardQuery {
  period: DashboardPeriod;
  metric: TrendMetric;
  filters: DashboardFilters;
}

/** Everything the overview dashboard renders, aggregated from storage in one pass. */
export const makeGetDashboard =
  ({ dashboard, orders, customers, tasks, activity, clock }: DashboardDeps) =>
  async ({ period, metric, filters = {} }: DashboardQuery) => {
    const now = clock();
    const range = periodRange(period, now);
    const monthStart = periodRange("month", now).start;
    const { category, customerId, assigneeId } = filters;

    const [allFacts, customerCounts, newThisMonth, openTasks, recentOrders, recentActivity, overdue, contacts] = await Promise.all([
      dashboard.orderFacts(),
      customers.countByStatus(),
      customers.countCreatedSince(monthStart),
      tasks.listBoard({ openOnly: true, assigneeId, customerId }),
      orders.list({ page: 1, pageSize: RECENT_ORDER_LIMIT, asOf: now, category, customerId }),
      activity.recent(ACTIVITY_LIMIT),
      orders.list({ status: "overdue", asOf: now, page: 1, pageSize: OVERDUE_SCAN_LIMIT, category, customerId }),
      customers.listOptions(),
    ]);
    const facts = allFacts.filter((o) => (!category || o.category === category) && (!customerId || o.customerId === customerId));

    const gross = revenueTrend(facts, now, "gross", TREND_MONTHS);
    const trend = metric === "gross" ? gross : revenueTrend(facts, now, "collected", TREND_MONTHS);
    const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (TREND_MONTHS - 1), 1));
    const windowDeals = facts.filter((o) => o.status !== "draft" && o.status !== "cancelled" && o.issueDate >= windowStart && o.issueDate < now);
    const emailById = new Map(contacts.map((c) => [c.id, c.contactEmail]));

    return {
      now,
      range,
      filters,
      sales: { ...totalSales(facts, range), sparkline: gross.points },
      outstanding: outstandingInvoices(facts, now),
      customers: { active: customerCounts.active, newThisMonth },
      attention: attentionTasks(openTasks, now),
      trend: { metric, ...trend },
      averageDealCents: windowDeals.length ? Math.round(windowDeals.reduce((s, o) => s + o.amountCents, 0) / windowDeals.length) : 0,
      onTimeRate: onTimeDeliveryRate(facts),
      runRateCents: projectedRunRateCents(gross.points),
      categories: revenueByCategory(facts, range),
      critical: criticalTasks(openTasks, now, CRITICAL_TASK_LIMIT),
      recentOrders: recentOrders.items,
      activity: recentActivity,
      overdue: {
        total: overdue.total,
        items: overdue.items
          .map((o) => ({ ...o, daysOverdue: daysOverdue(o, now), contactEmail: emailById.get(o.customerId) ?? null }))
          .sort((a, b) => b.daysOverdue - a.daysOverdue || b.amountCents - a.amountCents)
          .slice(0, OVERDUE_CARD_LIMIT),
      },
    };
  };

export type DashboardView = Awaited<ReturnType<ReturnType<typeof makeGetDashboard>>>;

export class ReminderNotAllowedError extends Error {
  constructor(reference: string) {
    super(`Order ${reference} is not overdue, so no reminder was sent.`);
    this.name = "ReminderNotAllowedError";
  }
}

export interface ReminderSender {
  /** Workspace name shown as the sender. */
  issuer: string;
  /** Public origin of the app, for the invoice link. */
  baseUrl: string;
}

/**
 * "Send Reminder" on an overdue receivable: emails the customer's billing (or contact) address through the
 * outbox (kind "reminder"), records a billing activity with the delivery status and notifies the order's
 * creator. Delivery failures do not throw; the returned email carries the outbox status.
 */
export const makeSendPaymentReminder =
  ({
    orders,
    customers,
    activity,
    clock,
    notify,
    sendEmail,
  }: Pick<DashboardDeps, "orders" | "customers" | "activity" | "clock"> & { notify?: Notify; sendEmail?: (email: NewOutboxEmail) => Promise<OutboxEmail> }) =>
  async (reference: string, actorId: number | null, sender?: ReminderSender) => {
    const now = clock();
    const order = await orders.findByReference(reference);
    if (!order) throw new NotFoundError("Order", reference);
    if (effectiveOrderStatus(order, now) !== "overdue") throw new ReminderNotAllowedError(reference);
    const label = order.invoiceNumber ?? order.reference;

    let email: OutboxEmail | null = null;
    let recipient: string | null = null;
    if (sendEmail && sender) {
      const customer = await customers.findById(order.customerId);
      if (!customer) throw new NotFoundError("Customer", order.customerId);
      recipient = customer.billingEmail ?? customer.contactEmail;
      const base = sender.baseUrl.replace(/\/+$/, "");
      const content = invoiceEmail({
        kind: "reminder",
        invoiceNumber: label,
        company: customer.company,
        contactName: customer.contactName,
        issuer: sender.issuer,
        amountCents: order.amountCents,
        balanceCents: orderBalance(order),
        issueDate: order.issueDate,
        dueDate: order.dueDate,
        daysOverdue: daysOverdue(order, now),
        link: order.invoiceNumber ? `${base}/invoices/${encodeURIComponent(order.invoiceNumber)}` : `${base}/sales?order=${encodeURIComponent(order.reference)}`,
      });
      email = await sendEmail({ to: recipient, ...content, kind: "reminder", relatedEntityType: "order", relatedEntityId: order.id, createdById: actorId });
    }

    await activity.record({
      actorId,
      message: `sent payment reminder to ${order.customerCompany} for Invoice #${label}${email ? ` (${email.status})` : ""}`,
      category: "billing",
      entityType: "order",
      entityId: order.id,
      createdAt: now,
    });
    if (notify) {
      await notify({
        recipientIds: [await activity.originatorOf("order", order.id)],
        actorId,
        type: "payment_reminder",
        title: `Payment reminder sent for ${label}`,
        body: order.customerCompany,
        href: `/sales?order=${encodeURIComponent(order.reference)}`,
      });
    }
    return { company: order.customerCompany, email, recipient };
  };
