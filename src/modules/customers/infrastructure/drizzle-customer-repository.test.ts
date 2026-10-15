import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleActivityRepository } from "@/modules/activity/infrastructure/drizzle-activity-repository";
import type { Database } from "@/server/db/connect";
import { seedDatabase } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import { DrizzleOrderRepository } from "@/modules/sales/infrastructure/drizzle-order-repository";
import {
  DuplicateCustomerError,
  makeCreateCustomer,
  makeGetCustomerDirectoryStats,
  makeGetCustomerProfile,
  makeGetCustomerSummary,
} from "../application/use-cases";
import { DrizzleCustomerRepository } from "./drizzle-customer-repository";

const now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  await seedDatabase(db, now);
});
afterAll(() => cleanup());

const deps = () => ({ customers: new DrizzleCustomerRepository(db), activity: new DrizzleActivityRepository(db), clock: () => now });

describe("customer directory queries", () => {
  it("returns a single customer with sales aggregates", async () => {
    const apex = (await deps().customers.list({ search: "Apex" })).items[0]!;
    const summary = await makeGetCustomerSummary(deps())(apex.id);
    expect(summary?.company).toBe("Apex Digital Labs");
    expect(summary?.totalSalesCents).toBe(apex.totalSalesCents);
    expect(await makeGetCustomerSummary(deps())(999_999)).toBeNull();
  });

  it("counts customers created since a date", async () => {
    const { customers } = deps();
    const before = await customers.countCreatedSince(new Date("2026-10-01T00:00:00Z"));
    await makeCreateCustomer(deps())({
      company: "Quarterly Newco",
      tier: "project",
      status: "active",
      industry: "Retail",
      contactName: "Ana Ruiz",
      contactEmail: "ana@newco.io",
    });
    expect(await customers.countCreatedSince(new Date("2026-10-01T00:00:00Z"))).toBe(before + 1);
  });

  it("rejects duplicate company names regardless of case", async () => {
    await expect(
      makeCreateCustomer(deps())({
        company: "apex digital labs",
        tier: "project",
        status: "active",
        industry: "Technology",
        contactName: "Someone",
        contactEmail: "someone@apex.io",
      }),
    ).rejects.toBeInstanceOf(DuplicateCustomerError);
  });
});

describe("directory stats and profile", () => {
  it("aggregates header KPIs from customers and orders", async () => {
    const stats = await makeGetCustomerDirectoryStats({ ...deps(), orders: new DrizzleOrderRepository(db) })();
    expect(stats.totalAccounts).toBeGreaterThanOrEqual(14);
    expect(stats.pipelineCents).toBeGreaterThan(0);
    expect(stats.retention).toBeGreaterThan(0);
    expect(stats.retention).toBeLessThanOrEqual(1);
  });

  it("builds a customer profile with open deals, health and recent orders", async () => {
    const apex = (await deps().customers.list({ search: "Apex" })).items[0]!;
    const profile = await makeGetCustomerProfile({ ...deps(), orders: new DrizzleOrderRepository(db) })(apex.id);
    expect(profile?.customer.company).toBe("Apex Digital Labs");
    expect(profile?.recentOrders.length).toBeGreaterThan(0);
    expect(profile?.healthScore).toBeGreaterThanOrEqual(0);
  });
});
