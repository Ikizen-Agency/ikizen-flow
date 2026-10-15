import type { ActivityRepository } from "../../activity/application/ports";
import type { OrderRepository } from "../../sales/application/ports";
import { billedBetween, isOpen, openPipelineCents } from "../../sales/domain/metrics";
import { daysOverdue } from "../../sales/domain/order";
import type { NewOutboxEmail } from "../../mail/application/ports";
import type { OutboxEmail } from "../../mail/domain/email";
import { NotFoundError, type Clock } from "../../shared-types";
import { addDays, daysBetween, startOfQuarter } from "@/shared/domain/time";
import { percentChange } from "@/shared/domain/stats";
import {
  assertCustomerDeletable,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TIER_LABELS,
  customerHealthScore,
  retentionRate,
  type CustomerDependencies,
  type CustomerTier,
} from "../domain/customer";
import type { Customer, CustomerListQuery, CustomerPatch, CustomerRepository, NewCustomer } from "./ports";

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

/** What changed, as an activity predicate ("changed X status to Active", "updated client details for X"). */
function describeUpdate(before: Customer, after: Customer): string {
  const changes: string[] = [];
  if (before.baseStatus !== after.baseStatus) changes.push(`status to ${CUSTOMER_STATUS_LABELS[after.baseStatus]}`);
  if (before.tier !== after.tier) changes.push(`tier to ${CUSTOMER_TIER_LABELS[after.tier]}`);
  const otherFieldsChanged = (["company", "industry", "contactName", "contactEmail", "billingEmail", "paymentTerms"] as const).some(
    (field) => before[field] !== after[field],
  );
  if (changes.length > 0 && !otherFieldsChanged) return `changed ${after.company} ${changes.join(" and ")}`;
  return `updated client details for ${after.company}`;
}

/** Edits any field from the create form, keeping company names unique per workspace. */
export const makeUpdateCustomer =
  ({ customers, activity, clock }: CustomerDeps) =>
  async (id: number, patch: CustomerPatch, actorId: number | null = null) => {
    const before = await customers.findById(id);
    if (!before) throw new NotFoundError("Customer", id);
    if (patch.company !== undefined) {
      const clash = await customers.findByCompany(patch.company);
      if (clash && clash.id !== id) throw new DuplicateCustomerError(patch.company);
    }
    const now = clock();
    const updated = await customers.update(id, patch, now);
    if (!updated) throw new NotFoundError("Customer", id);
    await activity.record({ actorId, message: describeUpdate(before, updated), category: "pipeline", entityType: "customer", entityId: id, createdAt: now });
    return updated;
  };

/** Archives (or restores) the workspace's customers among `ids`; returns the customers that changed. */
export const makeArchiveCustomers =
  ({ customers, activity, clock }: CustomerDeps) =>
  async (ids: ReadonlyArray<number>, archived: boolean, actorId: number | null = null) => {
    const now = clock();
    const changedIds = await customers.setArchived(ids, archived ? now : null, now);
    const changed = await customers.findManyByIds(changedIds);
    for (const customer of changed) {
      await activity.record({
        actorId,
        message: `${archived ? "archived" : "restored"} client ${customer.company}`,
        category: "pipeline",
        entityType: "customer",
        entityId: customer.id,
        createdAt: now,
      });
    }
    return changed;
  };

/** "Apply Tier Tag": retags the workspace's customers among `ids`. */
export const makeApplyCustomerTier =
  ({ customers, activity, clock }: CustomerDeps) =>
  async (ids: ReadonlyArray<number>, tier: CustomerTier, actorId: number | null = null) => {
    const now = clock();
    const changed = await customers.findManyByIds(await customers.setTier(ids, tier, now));
    for (const customer of changed) {
      await activity.record({
        actorId,
        message: `moved ${customer.company} to the ${CUSTOMER_TIER_LABELS[tier]} tier`,
        category: "pipeline",
        entityType: "customer",
        entityId: customer.id,
        createdAt: now,
      });
    }
    return changed;
  };

export interface DeleteCustomersResult {
  deleted: Customer[];
  /** Customers kept because they have orders or tasks (archive them instead). */
  skipped: Array<{ customer: Customer } & CustomerDependencies>;
}

/** Hard-deletes the workspace's customers among `ids` that have no orders or tasks. */
export const makeDeleteCustomers =
  ({ customers, activity, clock }: CustomerDeps) =>
  async (ids: ReadonlyArray<number>, actorId: number | null = null): Promise<DeleteCustomersResult> => {
    const found = await customers.findManyByIds(ids);
    const dependencies = await customers.dependencies(found.map((c) => c.id));
    const result: DeleteCustomersResult = { deleted: [], skipped: [] };
    const deletable: Customer[] = [];
    for (const customer of found) {
      const deps = dependencies.get(customer.id) ?? { orders: 0, tasks: 0 };
      if (deps.orders > 0 || deps.tasks > 0) result.skipped.push({ customer, ...deps });
      else deletable.push(customer);
    }
    // The repository re-checks dependencies atomically; customers that gained history meanwhile are reported as skipped.
    const deletedIds = new Set(await customers.deleteMany(deletable.map((c) => c.id)));
    result.deleted = deletable.filter((c) => deletedIds.has(c.id));
    const kept = deletable.filter((c) => !deletedIds.has(c.id));
    if (kept.length > 0) {
      const fresh = await customers.dependencies(kept.map((c) => c.id));
      for (const customer of kept) {
        const deps = fresh.get(customer.id);
        if (deps && (deps.orders > 0 || deps.tasks > 0)) result.skipped.push({ customer, ...deps });
      }
    }
    const now = clock();
    for (const customer of result.deleted) {
      await activity.record({ actorId, message: `deleted client ${customer.company}`, category: "pipeline", entityType: "customer", entityId: customer.id, createdAt: now });
    }
    return result;
  };

/** Deletes one customer, or throws `CustomerHasDependenciesError` suggesting to archive it. */
export const makeDeleteCustomer = (deps: CustomerDeps) => {
  const deleteMany = makeDeleteCustomers(deps);
  return async (id: number, actorId: number | null = null) => {
    const customer = await deps.customers.findById(id);
    if (!customer) throw new NotFoundError("Customer", id);
    assertCustomerDeletable(customer.company, (await deps.customers.dependencies([id])).get(id) ?? { orders: 0, tasks: 0 });
    const { skipped } = await deleteMany([id], actorId);
    if (skipped[0]) assertCustomerDeletable(customer.company, skipped[0]);
    return customer;
  };
};

export interface CampaignInput {
  ids: ReadonlyArray<number>;
  subject: string;
  message: string;
}

export interface CampaignSummary {
  total: number;
  sent: number;
  logged: number;
  failed: number;
}

/** "Send Campaign": one outbox email (kind `campaign`) to the contact of each selected customer. */
export const makeSendCampaign =
  ({ customers, activity, clock, sendEmail }: CustomerDeps & { sendEmail: (email: NewOutboxEmail) => Promise<OutboxEmail> }) =>
  async ({ ids, subject, message }: CampaignInput, actorId: number | null = null): Promise<CampaignSummary> => {
    const recipients = await customers.findManyByIds(ids);
    const summary: CampaignSummary = { total: recipients.length, sent: 0, logged: 0, failed: 0 };
    for (const customer of recipients) {
      try {
        const email = await sendEmail({
          to: customer.contactEmail,
          subject,
          text: `Hi ${customer.contactName},\n\n${message}`,
          kind: "campaign",
          relatedEntityType: "customer",
          relatedEntityId: customer.id,
          createdById: actorId,
        });
        summary[email.status === "queued" ? "failed" : email.status] += 1;
      } catch {
        // Invalid recipient address (rejected before it is stored): count it and keep going.
        summary.failed += 1;
      }
    }
    if (recipients.length > 0) {
      await activity.record({
        actorId,
        message: `sent the campaign "${subject}" to ${recipients.length} client${recipients.length === 1 ? "" : "s"}`,
        category: "pipeline",
        createdAt: clock(),
      });
    }
    return summary;
  };
