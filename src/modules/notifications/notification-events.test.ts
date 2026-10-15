import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleActivityRepository } from "@/modules/activity/infrastructure/drizzle-activity-repository";
import { DrizzleCustomerRepository } from "@/modules/customers/infrastructure/drizzle-customer-repository";
import { makeSendPaymentReminder } from "@/modules/dashboard/application/use-cases";
import { makeChangeOrderStatus, makeCreateOrder } from "@/modules/sales/application/use-cases";
import { DrizzleOrderRepository } from "@/modules/sales/infrastructure/drizzle-order-repository";
import { makeCreateTask } from "@/modules/tasks/application/use-cases";
import { DrizzleTaskRepository } from "@/modules/tasks/infrastructure/drizzle-task-repository";
import { DrizzleMemberRepository } from "@/modules/team/infrastructure/drizzle-member-repository";
import type { Database } from "@/server/db/connect";
import { seedDatabase, type SeedSummary } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import { makeListNotifications, makeNotify } from "./application/use-cases";
import { DrizzleNotificationRepository } from "./infrastructure/drizzle-notification-repository";

const now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;
let seed: SeedSummary;
let alex: number;
let maya: number;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  seed = await seedDatabase(db, now);
  const people = await new DrizzleMemberRepository(db, seed.workspaces.northstar).list();
  alex = people.find((m) => m.name === "Alex Vance")!.id;
  maya = people.find((m) => m.name === "Maya Chen")!.id;
});
afterAll(() => cleanup());

function north() {
  const workspaceId = seed.workspaces.northstar;
  const notifications = new DrizzleNotificationRepository(db, workspaceId);
  const deps = {
    customers: new DrizzleCustomerRepository(db, workspaceId),
    orders: new DrizzleOrderRepository(db, workspaceId),
    tasks: new DrizzleTaskRepository(db, workspaceId),
    activity: new DrizzleActivityRepository(db, workspaceId),
    clock: () => now,
    notify: makeNotify({ notifications, clock: () => now }),
  };
  return { deps, inbox: (memberId: number) => makeListNotifications({ notifications })(memberId, { pageSize: 50 }) };
}

describe("notification events", () => {
  it("notifies the assignee when someone else creates a task for them", async () => {
    const { deps, inbox } = north();
    const before = (await inbox(maya)).total;
    const task = await makeCreateTask(deps)({ title: "Review onboarding copy", status: "todo", priority: "high", assigneeId: maya }, alex);
    const items = (await inbox(maya)).items;
    expect(items.length).toBe(before + 1);
    expect(items[0]).toMatchObject({ type: "task_assigned", href: `/tasks?task=${task.id}`, readAt: null });
    expect(items[0]!.title).toContain(task.code);

    const self = (await inbox(alex)).total;
    await makeCreateTask(deps)({ title: "Self-assigned", status: "todo", priority: "low", assigneeId: alex }, alex);
    expect((await inbox(alex)).total).toBe(self);
  });

  it("notifies the order's creator about status changes made by someone else", async () => {
    const { deps, inbox } = north();
    const customer = (await deps.customers.list({ search: "Apex" })).items[0]!;
    const order = await makeCreateOrder(deps)(
      { customerId: customer.id, title: "Notification probe", category: "custom_software", paymentTerms: "net_30", status: "pending", items: [{ title: "Work", quantity: 1, unitRateCents: 10_000 }] },
      maya,
    );
    const before = (await inbox(maya)).total;
    await makeChangeOrderStatus(deps)(order.reference, "processing", alex);
    const items = (await inbox(maya)).items;
    expect(items.length).toBe(before + 1);
    expect(items[0]).toMatchObject({ type: "order_status", href: `/sales?order=${order.reference}` });

    await makeChangeOrderStatus(deps)(order.reference, "invoiced", maya);
    expect((await inbox(maya)).total).toBe(before + 1);
  });

  it("notifies the order's creator when a payment reminder is sent", async () => {
    const { deps, inbox } = north();
    const customer = (await deps.customers.list({ search: "Solas" })).items[0]!;
    const order = await makeCreateOrder(deps)(
      {
        customerId: customer.id,
        title: "Overdue probe",
        category: "custom_software",
        paymentTerms: "net_15",
        status: "pending",
        issueDate: new Date(now.getTime() - 60 * 86_400_000),
        items: [{ title: "Work", quantity: 1, unitRateCents: 10_000 }],
      },
      maya,
    );
    await makeChangeOrderStatus(deps)(order.reference, "invoiced", maya);
    const before = (await inbox(maya)).total;
    await makeSendPaymentReminder(deps)(order.reference, alex);
    const items = (await inbox(maya)).items;
    expect(items.length).toBe(before + 1);
    expect(items[0]).toMatchObject({ type: "payment_reminder" });
  });
});
