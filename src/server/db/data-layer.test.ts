import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleActivityRepository } from "@/modules/activity/infrastructure/drizzle-activity-repository";
import { DrizzleCustomerRepository } from "@/modules/customers/infrastructure/drizzle-customer-repository";
import { makeChangeOrderStatus, makeCreateOrder } from "@/modules/sales/application/use-cases";
import { InvalidOrderTransitionError } from "@/modules/sales/domain/order";
import { DrizzleOrderRepository } from "@/modules/sales/infrastructure/drizzle-order-repository";
import { makeGetTaskBoard, makeMoveTask } from "@/modules/tasks/application/use-cases";
import { DrizzleTaskRepository } from "@/modules/tasks/infrastructure/drizzle-task-repository";
import { createTestDatabase } from "@/test/test-database";
import type { Database } from "./connect";
import { seedDatabase } from "./seed/seed";

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

function deps() {
  return {
    customers: new DrizzleCustomerRepository(db, ws),
    orders: new DrizzleOrderRepository(db, ws),
    tasks: new DrizzleTaskRepository(db, ws),
    activity: new DrizzleActivityRepository(db, ws),
    clock: () => now,
  };
}

describe("seeded data layer", () => {
  it("lists customers with sales aggregates, search and status filters", async () => {
    const { customers } = deps();
    const page = await customers.list({ search: "apex", pageSize: 10 });
    expect(page.total).toBe(1);
    expect(page.items[0]?.company).toBe("Apex Digital Labs");
    expect(page.items[0]?.totalSalesCents).toBeGreaterThan(0);

    const inactive = await customers.list({ status: "inactive" });
    expect(inactive.items.map((c) => c.company)).toEqual(["Terra Firma Design"]);
  });

  it("ends the order sequence at the design's latest reference", async () => {
    expect(await deps().orders.latestReference()).toBe("SL-1048");
  });

  it("creates an order with computed totals, the next reference and an activity entry", async () => {
    const d = deps();
    const apex = (await d.customers.list({ search: "Apex" })).items[0]!;
    const order = await makeCreateOrder(d)({
      customerId: apex.id,
      title: "Q4 UX Architecture & Prototyping Retainer",
      category: "ux_ui_retainer",
      paymentTerms: "net_30",
      status: "pending",
      discountBps: 500,
      items: [
        { title: "Retainer", quantity: 1, unitRateCents: 850000 },
        { title: "Cloud migration", quantity: 40, unit: "hours", unitRateCents: 16500 },
      ],
    });
    expect(order.reference).toBe("SL-1049");
    expect(order.amountCents).toBe(1434500);
    expect(order.dueDate.toISOString()).toBe("2026-11-13T12:00:00.000Z");

    const stored = await d.orders.findByReference("SL-1049");
    expect(stored?.items).toHaveLength(2);
    const [latest] = await d.activity.recent(1);
    expect(latest?.message).toContain("SL-1049");
  });

  it("enforces order status transitions and stamps invoice numbers", async () => {
    const d = deps();
    const change = makeChangeOrderStatus(d);
    await change("SL-1049", "invoiced");
    expect((await d.orders.findByReference("SL-1049"))?.invoiceNumber).toBe("INV-1049");
    await expect(change("SL-1049", "draft")).rejects.toBeInstanceOf(InvalidOrderTransitionError);
  });

  it("groups the task board by status and moves tasks between columns", async () => {
    const d = deps();
    const board = await makeGetTaskBoard(d)();
    expect(board.blocked.map((t) => t.code)).toEqual(["TASK-840", "TASK-841"]);
    const wireframes = board.in_progress.find((t) => t.code === "TASK-842")!;
    expect(wireframes.subtasks.filter((s) => s.done)).toHaveLength(8);

    await makeMoveTask(d)(wireframes.id, "completed");
    const moved = await d.tasks.findById(wireframes.id);
    expect(moved?.status).toBe("completed");
    expect(moved?.completedAt?.toISOString()).toBe(now.toISOString());
  });
});
