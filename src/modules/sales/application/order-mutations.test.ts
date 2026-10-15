import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleActivityRepository } from "@/modules/activity/infrastructure/drizzle-activity-repository";
import { DrizzleCustomerRepository } from "@/modules/customers/infrastructure/drizzle-customer-repository";
import type { NotifyInput } from "@/modules/notifications/application/use-cases";
import type { Database } from "@/server/db/connect";
import { seedDatabase } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import { NotFoundError } from "../../shared-types";
import { dueDateFor, OrderNotDeletableError, OrderNotEditableError, type OrderStatus } from "../domain/order";
import { PaymentRejectedError } from "../domain/payment";
import { DrizzleOrderRepository } from "../infrastructure/drizzle-order-repository";
import { DrizzlePaymentRepository } from "../infrastructure/drizzle-payment-repository";
import {
  makeChangeOrderStatus,
  makeCreateOrder,
  makeDeleteOrder,
  makeDeletePayment,
  makeRecordPayment,
  makeUpdateOrder,
} from "./use-cases";

const now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;
let ws: number;
let sandboxWs: number;
let actor: number;
const notified: NotifyInput[] = [];

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  const seeded = await seedDatabase(db, now);
  ws = seeded.workspaces.northstar;
  sandboxWs = seeded.workspaces.sandbox;
  actor = seeded.demoMembers.northstar;
});
afterAll(() => cleanup());

const deps = (workspaceId = ws) => ({
  orders: new DrizzleOrderRepository(db, workspaceId),
  customers: new DrizzleCustomerRepository(db, workspaceId),
  activity: new DrizzleActivityRepository(db, workspaceId),
  payments: new DrizzlePaymentRepository(db, workspaceId),
  clock: () => now,
  notify: async (input: NotifyInput) => {
    notified.push(input);
    return 1;
  },
});

async function newOrder(status: "draft" | "pending" = "draft", amount = 100_000) {
  const apex = (await deps().customers.findByCompany("Apex Digital Labs"))!;
  return makeCreateOrder(deps())(
    { customerId: apex.id, title: "Test order", category: "custom_software", paymentTerms: "net_30", status, items: [{ title: "Work", quantity: 1, unitRateCents: amount }] },
    actor,
  );
}

async function inStatus(status: OrderStatus) {
  const order = await newOrder("pending");
  const change = makeChangeOrderStatus(deps());
  if (status === "invoiced" || status === "processing") await change(order.reference, status, actor);
  return (await deps().orders.findByReference(order.reference))!;
}

describe("updateOrder", () => {
  it("rewrites a draft's customer, terms, category and items and recomputes totals and due date", async () => {
    const draft = await newOrder("draft");
    const solas = (await deps().customers.list({ pageSize: 20 })).items.find((c) => c.company !== "Apex Digital Labs")!;
    await makeUpdateOrder(deps())(
      draft.reference,
      {
        customerId: solas.id,
        category: "cloud_architecture",
        paymentTerms: "net_15",
        discountBps: 500,
        items: [
          { title: "Discovery", quantity: 2, unit: "hours", unitRateCents: 15_000 },
          { title: "Build", quantity: 1, unitRateCents: 50_000 },
        ],
      },
      actor,
    );
    const updated = (await deps().orders.findByReference(draft.reference))!;
    expect(updated).toMatchObject({ customerId: solas.id, category: "cloud_architecture", paymentTerms: "net_15", title: "Discovery", subtotalCents: 80_000, discountCents: 4_000, amountCents: 76_000 });
    expect(updated.dueDate).toEqual(dueDateFor(updated.issueDate, "net_15"));
    expect(updated.items.map((i) => i.title)).toEqual(["Discovery", "Build"]);
    expect((await deps().activity.forEntity("order", draft.id, 1))[0]?.message).toMatch(/updated order/);
  });

  it("rejects editing an order once it is invoiced", async () => {
    const invoiced = await inStatus("invoiced");
    await expect(
      makeUpdateOrder(deps())(invoiced.reference, { customerId: invoiced.customerId, category: "custom_software", paymentTerms: "net_30", items: [{ title: "X", quantity: 1, unitRateCents: 1 }] }, actor),
    ).rejects.toBeInstanceOf(OrderNotEditableError);
  });
});

describe("orders with recorded payments", () => {
  it("refuses to edit a pending order that already has payments (no hidden overpayment)", async () => {
    const pending = await newOrder("pending");
    await makeRecordPayment(deps())(pending.reference, { amountCents: 50_000, method: "card" }, actor);
    await expect(
      makeUpdateOrder(deps())(pending.reference, { customerId: pending.customerId, category: "custom_software", paymentTerms: "net_30", items: [{ title: "Cheaper", quantity: 1, unitRateCents: 10_000 }] }, actor),
    ).rejects.toThrow("Remove recorded payments before editing this order.");
    expect((await deps().orders.findByReference(pending.reference))!.amountCents).toBe(100_000);
  });

  it("refuses to delete a cancelled order with payments and keeps its payments", async () => {
    const pending = await newOrder("pending");
    await makeRecordPayment(deps())(pending.reference, { amountCents: 20_000, method: "cash" }, actor);
    await makeChangeOrderStatus(deps())(pending.reference, "cancelled", actor);
    await expect(makeDeleteOrder(deps())(pending.reference, actor)).rejects.toThrow("Orders with recorded payments cannot be deleted.");
    // The repository re-checks payments in the DELETE itself (no window between the check and the delete).
    expect(await deps().orders.delete(pending.id)).toBe(false);
    expect(await deps().orders.findByReference(pending.reference)).not.toBeNull();
    expect((await deps().payments.listForOrder(pending.id)).map((p) => p.amountCents)).toEqual([20_000]);
  });
});

describe("deleteOrder", () => {
  it("deletes drafts and cancelled orders", async () => {
    const draft = await newOrder("draft");
    await makeDeleteOrder(deps())(draft.reference, actor);
    expect(await deps().orders.findByReference(draft.reference)).toBeNull();

    const cancelled = await newOrder("pending");
    await makeChangeOrderStatus(deps())(cancelled.reference, "cancelled", actor);
    await makeDeleteOrder(deps())(cancelled.reference, actor);
    expect(await deps().orders.findByReference(cancelled.reference)).toBeNull();
  });

  it("refuses to delete an order in progress", async () => {
    const pending = await newOrder("pending");
    await expect(makeDeleteOrder(deps())(pending.reference, actor)).rejects.toBeInstanceOf(OrderNotDeletableError);
  });
});

describe("payments", () => {
  it("records partial payments, rejects overpayment and completes the order when fully paid", async () => {
    const order = await inStatus("invoiced");
    const record = makeRecordPayment(deps());
    notified.length = 0;

    const first = await record(order.reference, { amountCents: 40_000, method: "bank_transfer", reference: "WIRE-1", note: "Deposit" }, actor);
    expect(first.completed).toBe(false);
    let stored = (await deps().orders.findByReference(order.reference))!;
    expect(stored).toMatchObject({ status: "invoiced", paidCents: 40_000 });

    await expect(record(order.reference, { amountCents: 60_001, method: "card" }, actor)).rejects.toBeInstanceOf(PaymentRejectedError);

    const paidAt = new Date("2026-10-13T09:00:00Z");
    const second = await record(order.reference, { amountCents: 60_000, method: "card", paidAt }, actor);
    expect(second.completed).toBe(true);
    stored = (await deps().orders.findByReference(order.reference))!;
    expect(stored).toMatchObject({ status: "completed", paidCents: 100_000 });
    expect(stored.paidAt).toEqual(paidAt);

    const history = await deps().payments.listForOrder(order.id);
    expect(history.map((p) => p.amountCents).sort((a, b) => a - b)).toEqual([40_000, 60_000]);
    expect(history.find((p) => p.amountCents === 40_000)).toMatchObject({ method: "bank_transfer", reference: "WIRE-1", note: "Deposit", recordedById: actor });
    expect(notified.length).toBe(2);
    expect(notified[0]).toMatchObject({ type: "payment_received", actorId: actor, href: `/sales?order=${order.reference}` });
  });

  it("deleting a payment of a completed order reopens it as invoiced", async () => {
    const order = await inStatus("invoiced");
    await makeRecordPayment(deps())(order.reference, { amountCents: 100_000, method: "cash" }, actor);
    const [payment] = await deps().payments.listForOrder(order.id);
    await makeDeletePayment(deps())(payment!.id, actor);
    const stored = (await deps().orders.findByReference(order.reference))!;
    expect(stored).toMatchObject({ status: "invoiced", paidCents: 0, paidAt: null });
  });

  it("marking an order as paid records the remaining balance as a payment", async () => {
    const order = await inStatus("invoiced");
    await makeRecordPayment(deps())(order.reference, { amountCents: 25_000, method: "card" }, actor);
    // Partial payment leaves it invoiced; the manual "Mark as Paid" settles the rest.
    await makeChangeOrderStatus(deps())(order.reference, "completed", actor);
    const stored = (await deps().orders.findByReference(order.reference))!;
    expect(stored).toMatchObject({ status: "completed", paidCents: 100_000 });
  });

  it("keeps payments inside their workspace", async () => {
    const order = await inStatus("invoiced");
    await makeRecordPayment(deps())(order.reference, { amountCents: 1_000, method: "other" }, actor);
    const [payment] = await deps().payments.listForOrder(order.id);

    const foreign = new DrizzlePaymentRepository(db, sandboxWs);
    expect(await foreign.findById(payment!.id)).toBeNull();
    expect(await foreign.listForOrder(order.id)).toEqual([]);
    expect(await foreign.delete(payment!.id)).toBe(false);
    await expect(foreign.record({ orderId: order.id, amountCents: 5, method: "cash", paidAt: now, recordedById: null }, now)).rejects.toBeInstanceOf(NotFoundError);
    await expect(foreign.settleBalance({ orderId: order.id, method: "cash", paidAt: now, recordedById: null }, now)).rejects.toBeInstanceOf(NotFoundError);
    await expect(makeDeletePayment(deps(sandboxWs))(payment!.id, null)).rejects.toBeInstanceOf(NotFoundError);
    expect(await deps().payments.findById(payment!.id)).not.toBeNull();
  });
});

describe("atomic payment recording", () => {
  const payment = (orderId: number, amountCents: number) => ({ orderId, amountCents, method: "card" as const, paidAt: now, recordedById: actor });

  it("re-reads the balance inside the transaction, so a second payment over the balance is refused", async () => {
    const order = await inStatus("invoiced");
    const repo = deps().payments;
    expect(await repo.record(payment(order.id, 60_000), now)).toMatchObject({ paidCents: 60_000, completed: false });
    await expect(repo.record(payment(order.id, 60_000), now)).rejects.toBeInstanceOf(PaymentRejectedError);
    const settled = await repo.record(payment(order.id, 40_000), now);
    expect(settled).toMatchObject({ paidCents: 100_000, completed: true });
    expect(await deps().orders.findByReference(order.reference)).toMatchObject({ status: "completed", paidCents: 100_000, paidAt: now });
  });

  it("lets only one of two concurrent payments over the balance through", async () => {
    const order = await inStatus("invoiced");
    const repo = deps().payments;
    const outcomes = await Promise.allSettled([repo.record(payment(order.id, 60_000), now), repo.record(payment(order.id, 60_000), now)]);
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect((await deps().orders.findByReference(order.reference))!.paidCents).toBe(60_000);
  });

  it("settles only the remaining balance when an order is marked as paid twice", async () => {
    const order = await inStatus("invoiced");
    const repo = deps().payments;
    const settle = { orderId: order.id, method: "other" as const, paidAt: now, note: "Marked as paid", recordedById: actor };
    expect(await repo.settleBalance(settle, now)).toMatchObject({ amountCents: 100_000 });
    expect(await repo.settleBalance(settle, now)).toBeNull();
    expect((await deps().orders.findByReference(order.reference))!.paidCents).toBe(100_000);
  });
});

describe("seeded payments", () => {
  it("fully pays every completed order and leaves some invoices partially paid", async () => {
    const { items } = await deps().orders.list({ pageSize: 500 });
    const seeded = items.filter((o) => o.title !== "Test order" && o.title !== "Discovery");
    for (const o of seeded.filter((o) => o.status === "completed")) expect(o.paidCents).toBe(o.amountCents);
    const partial = seeded.filter((o) => o.paidCents > 0 && o.paidCents < o.amountCents);
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.every((o) => ["pending", "processing", "invoiced"].includes(o.status))).toBe(true);
  });
});
