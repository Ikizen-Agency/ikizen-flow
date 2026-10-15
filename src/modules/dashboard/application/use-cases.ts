import type { ActivityRepository } from "../../activity/application/ports";
import type { CustomerRepository } from "../../customers/application/ports";
import type { OrderRepository } from "../../sales/application/ports";
import { onTimeDeliveryRate } from "../../sales/domain/metrics";
import { daysOverdue, effectiveOrderStatus } from "../../sales/domain/order";
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

export interface DashboardQuery {
  period: DashboardPeriod;
  metric: TrendMetric;
}

/** Everything the overview dashboard renders, aggregated from storage in one pass. */
export const makeGetDashboard =
  ({ dashboard, orders, customers, tasks, activity, clock }: DashboardDeps) =>
  async ({ period, metric }: DashboardQuery) => {
    const now = clock();
    const range = periodRange(period, now);
    const monthStart = periodRange("month", now).start;

    const [facts, customerCounts, newThisMonth, openTasks, recentOrders, recentActivity, overdue, contacts] = await Promise.all([
      dashboard.orderFacts(),
      customers.countByStatus(),
      customers.countCreatedSince(monthStart),
      tasks.listBoard({ openOnly: true }),
      orders.list({ page: 1, pageSize: RECENT_ORDER_LIMIT, asOf: now }),
      activity.recent(ACTIVITY_LIMIT),
      orders.list({ status: "overdue", asOf: now, page: 1, pageSize: OVERDUE_SCAN_LIMIT }),
      customers.listOptions(),
    ]);

    const gross = revenueTrend(facts, now, "gross", TREND_MONTHS);
    const trend = metric === "gross" ? gross : revenueTrend(facts, now, "collected", TREND_MONTHS);
    const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (TREND_MONTHS - 1), 1));
    const windowDeals = facts.filter((o) => o.status !== "draft" && o.status !== "cancelled" && o.issueDate >= windowStart && o.issueDate < now);
    const emailById = new Map(contacts.map((c) => [c.id, c.contactEmail]));

    return {
      now,
      range,
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

/** Logs a payment reminder for an overdue order. Delivery (email) is out of scope; the audit trail is the record. */
export const makeSendPaymentReminder =
  ({ orders, activity, clock }: Pick<DashboardDeps, "orders" | "activity" | "clock">) =>
  async (reference: string, actorId: number | null) => {
    const now = clock();
    const order = await orders.findByReference(reference);
    if (!order) throw new NotFoundError("Order", reference);
    if (effectiveOrderStatus(order, now) !== "overdue") throw new ReminderNotAllowedError(reference);
    await activity.record({
      actorId,
      message: `sent payment reminder to ${order.customerCompany} for Invoice #${order.invoiceNumber ?? order.reference}`,
      category: "billing",
      entityType: "order",
      entityId: order.id,
      createdAt: now,
    });
    return { company: order.customerCompany };
  };
