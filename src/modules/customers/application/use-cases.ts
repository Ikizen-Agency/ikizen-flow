import type { ActivityRepository } from "../../activity/application/ports";
import type { Clock } from "../../shared-types";
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

export const makeCreateCustomer =
  ({ customers, activity, clock }: CustomerDeps) =>
  async (input: NewCustomer, actorId: number | null = null) => {
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
