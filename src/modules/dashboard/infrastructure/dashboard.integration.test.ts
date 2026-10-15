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
/** Northstar Studio, the workspace holding the design dataset. */
let ws: number;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  ws = (await seedDatabase(db, now)).workspaces.northstar;
});
afterAll(() => cleanup());

const deps = () => ({
  dashboard: new DrizzleDashboardRepository(db, ws),
  orders: new DrizzleOrderRepository(db, ws),
  customers: new DrizzleCustomerRepository(db, ws),
  tasks: new DrizzleTaskRepository(db, ws),
  activity: new DrizzleActivityRepository(db, ws),
  clock: () => now,
});

describe("overview dashboard", () => {
  it("aggregates every widget from storage", async () => {
    const view = await makeGetDashboard(deps())({ period: "month", metric: "gross", filters: {} });
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
    const gross = await makeGetDashboard(deps())({ period: "month", metric: "gross", filters: {} });
    const cash = await makeGetDashboard(deps())({ period: "month", metric: "collected", filters: {} });
    expect(cash.trend.points.map((p) => p.cents)).not.toEqual(gross.trend.points.map((p) => p.cents));
  });
});

describe("dashboard filters", () => {
  const all = () => makeGetDashboard(deps())({ period: "year", metric: "gross", filters: {} });

  it("limits revenue widgets to one category", async () => {
    const full = await all();
    const cloud = await makeGetDashboard(deps())({ period: "year", metric: "gross", filters: { category: "cloud_architecture" } });
    expect(cloud.categories.categories.filter((c) => c.cents > 0).map((c) => c.category)).toEqual(["cloud_architecture"]);
    expect(cloud.sales.cents).toBe(full.categories.categories.find((c) => c.category === "cloud_architecture")!.cents);
    expect(cloud.sales.cents).toBeLessThan(full.sales.cents);
    expect(cloud.recentOrders.every((o) => o.category === "cloud_architecture")).toBe(true);
    expect(cloud.overdue.items.every((o) => o.category === "cloud_architecture")).toBe(true);
  });

  it("limits orders and tasks to one customer", async () => {
    const full = await all();
    const target = full.overdue.items[0]!;
    const one = await makeGetDashboard(deps())({ period: "year", metric: "gross", filters: { customerId: target.customerId } });
    expect(one.recentOrders.length).toBeGreaterThan(0);
    expect(one.recentOrders.every((o) => o.customerId === target.customerId)).toBe(true);
    expect(one.overdue.items.every((o) => o.customerId === target.customerId)).toBe(true);
    expect(one.critical.items.every((t) => t.customerId === target.customerId)).toBe(true);
    expect(one.outstanding.cents).toBeLessThanOrEqual(full.outstanding.cents);
  });

  it("limits task widgets to one assignee", async () => {
    const full = await all();
    const assigneeId = full.critical.items.find((t) => t.assigneeId)!.assigneeId!;
    const mine = await makeGetDashboard(deps())({ period: "year", metric: "gross", filters: { assigneeId } });
    expect(mine.critical.items.length).toBeGreaterThan(0);
    expect(mine.critical.items.every((t) => t.assigneeId === assigneeId)).toBe(true);
    expect(mine.attention.total).toBeLessThanOrEqual(full.attention.total);
    expect(mine.sales.cents).toBe(full.sales.cents);
  });
});

describe("payment reminders", () => {
  it("records a billing activity and emails the customer's billing address", async () => {
    const view = await makeGetDashboard(deps())({ period: "month", metric: "gross", filters: {} });
    const target = view.overdue.items[0]!;
    const sent: Array<{ to: string; kind: string; subject: string; text: string }> = [];
    const sendEmail = async (email: { to: string; kind: string; subject: string; text: string }) => {
      sent.push(email);
      return { ...email, id: 1, status: "logged" as const, error: null } as never;
    };
    const customer = await new DrizzleCustomerRepository(db, ws).findById(target.customerId);
    const result = await makeSendPaymentReminder({ ...deps(), sendEmail })(target.reference, null, { issuer: "Northstar Studio", baseUrl: "http://app.test" });
    expect(result).toMatchObject({ company: target.customerCompany, recipient: customer!.billingEmail ?? customer!.contactEmail, email: { status: "logged" } });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: "reminder", to: customer!.billingEmail ?? customer!.contactEmail });
    expect(sent[0]!.subject).toMatch(/overdue/);
    expect(sent[0]!.text).toContain("http://app.test/");
    const [latest] = await new DrizzleActivityRepository(db, ws).recent(1);
    expect(latest).toMatchObject({ category: "billing", entityType: "order", entityId: target.id });
    expect(latest?.message).toContain(`sent payment reminder to ${target.customerCompany}`);
    expect(latest?.message).toContain("(logged)");
  });

  it("refuses reminders for orders that are not overdue or do not exist", async () => {
    const orders = new DrizzleOrderRepository(db, ws);
    const page = await orders.list({ status: "completed", asOf: now, pageSize: 1 });
    const completed = page.items[0]!;
    expect(effectiveOrderStatus(completed, now)).toBe("completed");
    await expect(makeSendPaymentReminder(deps())(completed.reference, null)).rejects.toBeInstanceOf(ReminderNotAllowedError);
    await expect(makeSendPaymentReminder(deps())("SL-0000", null)).rejects.toThrow(/not found/i);
  });
});
