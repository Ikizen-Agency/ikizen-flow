import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleActivityRepository } from "@/modules/activity/infrastructure/drizzle-activity-repository";
import { DuplicateCustomerError, makeCreateCustomer } from "@/modules/customers/application/use-cases";
import { DrizzleCustomerRepository } from "@/modules/customers/infrastructure/drizzle-customer-repository";
import { DrizzleDashboardRepository } from "@/modules/dashboard/infrastructure/drizzle-dashboard-repository";
import { makeChangeOrderStatus, makeCreateOrder } from "@/modules/sales/application/use-cases";
import { DrizzleOrderRepository } from "@/modules/sales/infrastructure/drizzle-order-repository";
import { DrizzlePaymentRepository } from "@/modules/sales/infrastructure/drizzle-payment-repository";
import { makeCreateTask, makeMoveTask, makeToggleSubtask } from "@/modules/tasks/application/use-cases";
import { DrizzleTaskRepository } from "@/modules/tasks/infrastructure/drizzle-task-repository";
import { DrizzleMemberRepository } from "@/modules/team/infrastructure/drizzle-member-repository";
import { createTestDatabase } from "@/test/test-database";
import type { Database } from "./connect";
import { seedDatabase, type SeedSummary } from "./seed/seed";

const now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;
let seed: SeedSummary;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  seed = await seedDatabase(db, now);
});
afterAll(() => cleanup());

function scoped(workspaceId: number) {
  return {
    customers: new DrizzleCustomerRepository(db, workspaceId),
    orders: new DrizzleOrderRepository(db, workspaceId),
    payments: new DrizzlePaymentRepository(db, workspaceId),
    tasks: new DrizzleTaskRepository(db, workspaceId),
    activity: new DrizzleActivityRepository(db, workspaceId),
    members: new DrizzleMemberRepository(db, workspaceId),
    dashboard: new DrizzleDashboardRepository(db, workspaceId),
    clock: () => now,
  };
}

const north = () => scoped(seed.workspaces.northstar);
const sandbox = () => scoped(seed.workspaces.sandbox);

describe("workspace isolation", () => {
  it("never lists another workspace's customers, orders, tasks, members or activity", async () => {
    const a = north();
    const b = sandbox();
    const northCompanies = (await a.customers.list({ pageSize: 100 })).items.map((c) => c.company);
    const sandboxCompanies = (await b.customers.list({ pageSize: 100 })).items.map((c) => c.company);
    expect(northCompanies).toContain("Apex Digital Labs");
    expect(sandboxCompanies.length).toBeGreaterThan(0);
    expect(sandboxCompanies).not.toContain("Apex Digital Labs");
    expect(northCompanies.some((c) => sandboxCompanies.includes(c))).toBe(false);

    const sandboxOrders = await b.orders.list({ pageSize: 100 });
    expect(sandboxOrders.total).toBe((await b.orders.listSummaries()).length);
    expect(sandboxOrders.items.every((o) => sandboxCompanies.includes(o.customerCompany))).toBe(true);
    expect((await b.dashboard.orderFacts()).length).toBe(sandboxOrders.total);
    expect((await a.orders.list({ pageSize: 100 })).total).toBeGreaterThanOrEqual(47);

    const northTaskCodes = (await a.tasks.listBoard({})).map((t) => t.code);
    const sandboxTasks = await b.tasks.listBoard({});
    expect(sandboxTasks.length).toBeGreaterThan(0);
    expect(sandboxTasks.every((t) => t.customerCompany === null || sandboxCompanies.includes(t.customerCompany))).toBe(true);
    expect(northTaskCodes).toContain("TASK-842");

    const sandboxMembers = (await b.members.list()).map((m) => m.email);
    expect(sandboxMembers).toContain("alex@northstar.studio");
    expect(sandboxMembers).not.toContain("maya@northstar.studio");

    const northActivity = (await a.activity.recent(100)).map((e) => e.message);
    const sandboxActivity = (await b.activity.recent(100)).map((e) => e.message);
    expect(sandboxActivity.some((m) => northActivity.includes(m))).toBe(false);
  });

  it("treats another workspace's ids and references as not found", async () => {
    const a = north();
    const b = sandbox();
    const apex = (await a.customers.list({ search: "Apex" })).items[0]!;
    expect(await b.customers.findById(apex.id)).toBeNull();
    expect(await b.customers.findSummaryById(apex.id)).toBeNull();
    expect(await b.orders.findByReference("SL-1048")).toBeNull();

    const northTask = (await a.tasks.listBoard({})).find((t) => t.subtasks.length > 0)!;
    expect(await b.tasks.findById(northTask.id)).toBeNull();
    await expect(makeMoveTask(b)(northTask.id, "completed")).rejects.toThrow(/not found/i);
    await expect(makeToggleSubtask(b)(northTask.id, northTask.subtasks[0]!.id, true)).rejects.toThrow(/not found/i);
    expect((await a.tasks.findById(northTask.id))?.status).toBe(northTask.status);

    await expect(
      makeCreateOrder(b)({
        customerId: apex.id,
        title: "Cross-tenant attempt",
        category: "custom_software",
        paymentTerms: "net_30",
        status: "draft",
        items: [{ title: "x", quantity: 1, unitRateCents: 100 }],
      }),
    ).rejects.toThrow(/not found/i);

    await expect(makeCreateTask(b)({ title: "Leak", status: "todo", priority: "low", customerId: apex.id })).rejects.toThrow(/not found/i);
    const maya = (await a.members.list()).find((m) => m.name === "Maya Chen")!;
    await expect(makeCreateTask(b)({ title: "Leak", status: "todo", priority: "low", assigneeId: maya.id })).rejects.toThrow(/not found/i);
  });
});

describe("per-workspace uniqueness", () => {
  it("allows the same company name in two workspaces but not twice in one", async () => {
    const created = await makeCreateCustomer(sandbox())({
      company: "Apex Digital Labs",
      tier: "project",
      status: "active",
      industry: "Technology",
      contactName: "Sarah Jenkins",
      contactEmail: "sarah@apexdigital.io",
    });
    expect(created.company).toBe("Apex Digital Labs");
    await expect(
      makeCreateCustomer(sandbox())({
        company: "APEX digital labs",
        tier: "project",
        status: "active",
        industry: "Technology",
        contactName: "Other",
        contactEmail: "other@apex.io",
      }),
    ).rejects.toBeInstanceOf(DuplicateCustomerError);
  });

  it("numbers orders, invoices and tasks independently per workspace", async () => {
    const b = sandbox();
    const latest = await b.orders.latestReference();
    expect(latest).not.toBe("SL-1048");
    const customer = (await b.customers.list({ pageSize: 1 })).items[0]!;
    const order = await makeCreateOrder(b)({
      customerId: customer.id,
      title: "Sandbox engagement",
      category: "custom_software",
      paymentTerms: "net_30",
      status: "pending",
      items: [{ title: "Discovery", quantity: 1, unitRateCents: 50_000 }],
    });
    // The Northstar sequence already contains this reference; the sandbox may reuse it.
    expect((await north().orders.findByReference(order.reference))?.customerCompany).not.toBe(customer.company);
    await makeChangeOrderStatus(b)(order.reference, "invoiced");
    expect((await b.orders.findByReference(order.reference))?.invoiceNumber).toBe(`INV-${order.reference.slice(3)}`);

    const task = await makeCreateTask(b)({ title: "Sandbox follow-up", status: "todo", priority: "low" });
    expect((await north().tasks.listBoard({})).some((t) => t.id === task.id)).toBe(false);
    expect(task.code).toMatch(/^TASK-\d+$/);
  });
});
