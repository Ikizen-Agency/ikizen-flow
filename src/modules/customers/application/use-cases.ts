import type { ActivityRepository } from "../../activity/application/ports";
import type { OrderRepository } from "../../sales/application/ports";
import { billedBetween, isOpen, openPipelineCents } from "../../sales/domain/metrics";
import { daysOverdue } from "../../sales/domain/order";
import type { Clock } from "../../shared-types";
import { addDays, daysBetween, startOfQuarter } from "@/shared/domain/time";
import { percentChange } from "@/shared/domain/stats";
import { customerHealthScore, retentionRate } from "../domain/customer";
import type { CustomerListQuery, CustomerRepository, NewCustomer } from "./ports";

export interface CustomerDeps {
  customers: CustomerRepository;
  activity: ActivityRepository;
  clock: Clock;
}

export const makeListCustomers =
  ({ customers }: Pick<CustomerDeps, "customers">) =>
  (query: CustomerListQuery = {}) =>
    customers.list({ page: 1, pageSize: 10, sort: "last_active", ...query });

export class DuplicateCustomerError extends Error {
  constructor(readonly company: string) {
    super(`A customer named "${company}" already exists.`);
    this.name = "DuplicateCustomerError";
  }
}

export const makeGetCustomerSummary =
  ({ customers }: Pick<CustomerDeps, "customers">) =>
  (id: number) =>
    customers.findSummaryById(id);

export const makeCreateCustomer =
  ({ customers, activity, clock }: CustomerDeps) =>
  async (input: NewCustomer, actorId: number | null = null) => {
    if (await customers.findByCompany(input.company)) throw new DuplicateCustomerError(input.company);
    const now = clock();
    const customer = await customers.create(input, now);
    await activity.record({
      actorId,
      message: `added new client ${customer.company}`,
      category: "pipeline",
      entityType: "customer",
      entityId: customer.id,
      createdAt: now,
    });
    return customer;
  };

const TREND_WINDOW_DAYS = 30;

/** Header badges and KPI tiles of the customers directory. */
export const makeGetCustomerDirectoryStats =
  ({ customers, orders, clock }: Pick<CustomerDeps, "customers" | "clock"> & { orders: OrderRepository }) =>
  async () => {
    const now = clock();
    const [counts, newThisQuarter, summaries] = await Promise.all([
      customers.countByStatus(),
      customers.countCreatedSince(startOfQuarter(now)),
      orders.listSummaries(),
    ]);
    const windowStart = addDays(now, -TREND_WINDOW_DAYS);
    return {
      totalAccounts: Object.values(counts).reduce((a, b) => a + b, 0),
      newThisQuarter,
      pipelineCents: openPipelineCents(summaries),
      billingTrend: percentChange(
        billedBetween(summaries, windowStart, now),
        billedBetween(summaries, addDays(windowStart, -TREND_WINDOW_DAYS), windowStart),
      ),
      retention: retentionRate(counts),
    };
  };

const PROFILE_ORDER_LIMIT = 100;

/** Slide-over profile: aggregates, open deals, health score and the latest orders as an interaction log. */
export const makeGetCustomerProfile =
  ({ customers, orders, clock }: Pick<CustomerDeps, "customers" | "clock"> & { orders: OrderRepository }) =>
  async (id: number) => {
    const customer = await customers.findSummaryById(id);
    if (!customer) return null;
    const now = clock();
    const { items } = await orders.list({ customerId: id, page: 1, pageSize: PROFILE_ORDER_LIMIT });
    const overdueOrders = items.filter((o) => daysOverdue(o, now) > 0).length;
    return {
      customer,
      openDeals: items.filter((o) => isOpen(o.status)).length,
      overdueOrders,
      healthScore: customerHealthScore({
        status: customer.status,
        daysSinceActivity: customer.lastActivityAt ? daysBetween(customer.lastActivityAt, now) : null,
        overdueOrders,
      }),
      recentOrders: items.slice(0, 3),
    };
  };
