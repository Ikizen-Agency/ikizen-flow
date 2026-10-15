import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleActivityRepository } from "@/modules/activity/infrastructure/drizzle-activity-repository";
import { DrizzleCustomerRepository } from "@/modules/customers/infrastructure/drizzle-customer-repository";
import { effectiveOrderStatus } from "@/modules/sales/domain/order";
import { DrizzleOrderRepository } from "@/modules/sales/infrastructure/drizzle-order-repository";
import { DrizzleTaskRepository } from "@/modules/tasks/infrastructure/drizzle-task-repository";
import type { Database } from "@/server/db/connect";
import { seedDatabase } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import { makeGetDashboard, makeSendPaymentReminder, ReminderNotAllowedError } from "../application/use-cases";
import { DrizzleDashboardRepository } from "./drizzle-dashboard-repository";

const now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  await seedDatabase(db, now);
});
afterAll(() => cleanup());

const deps = () => ({
  dashboard: new DrizzleDashboardRepository(db),
  orders: new DrizzleOrderRepository(db),
  customers: new DrizzleCustomerRepository(db),
  tasks: new DrizzleTaskRepository(db),
  activity: new DrizzleActivityRepository(db),
  clock: () => now,
});

describe("overview dashboard", () => {
  it("aggregates every widget from storage", async () => {
    const view = await makeGetDashboard(deps())({ period: "month", metric: "gross" });
    expect(view.trend.points).toHaveLength(6);
    expect(view.trend.points.some((p) => p.cents > 0)).toBe(true);
    expect(view.sales.cents).toBeGreaterThan(0);
    expect(view.customers.active).toBeGreaterThan(0);
    expect(view.categories.categories.reduce((a, c) => a + c.percent, 0)).toBe(100);
    expect(view.recentOrders).toHaveLength(4);
    expect(view.activity).toHaveLength(4);
    expect(view.critical.items.length).toBeGreaterThan(0);
    expect(view.critical.items.every((t) => t.status !== "completed")).toBe(true);

    expect(view.overdue.total).toBeGreaterThanOrEqual(2);
    expect(view.overdue.items).toHaveLength(2);
    const [first, second] = view.overdue.items;
    expect(first!.daysOverdue).toBeGreaterThanOrEqual(second!.daysOverdue);
    expect(first!.contactEmail).toMatch(/@/);
  });

  it("switches the trend to collected cash", async () => {
    const gross = await makeGetDashboard(deps())({ period: "month", metric: "gross" });
    const cash = await makeGetDashboard(deps())({ period: "month", metric: "collected" });
    expect(cash.trend.points.map((p) => p.cents)).not.toEqual(gross.trend.points.map((p) => p.cents));
  });
});

describe("payment reminders", () => {
  it("records a billing activity for an overdue order", async () => {
    const view = await makeGetDashboard(deps())({ period: "month", metric: "gross" });
    const target = view.overdue.items[0]!;
    await makeSendPaymentReminder(deps())(target.reference, null);
    const [latest] = await new DrizzleActivityRepository(db).recent(1);
    expect(latest).toMatchObject({ category: "billing", entityType: "order", entityId: target.id });
    expect(latest?.message).toContain(`sent payment reminder to ${target.customerCompany}`);
  });

  it("refuses reminders for orders that are not overdue or do not exist", async () => {
    const orders = new DrizzleOrderRepository(db);
    const page = await orders.list({ status: "completed", asOf: now, pageSize: 1 });
    const completed = page.items[0]!;
    expect(effectiveOrderStatus(completed, now)).toBe("completed");
    await expect(makeSendPaymentReminder(deps())(completed.reference, null)).rejects.toBeInstanceOf(ReminderNotAllowedError);
    await expect(makeSendPaymentReminder(deps())("SL-0000", null)).rejects.toThrow(/not found/i);
  });
});
