import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/db/connect";
import { seedDatabase } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import { makeGetSalesOverview } from "../application/use-cases";
import { effectiveOrderStatus } from "../domain/order";
import { DrizzleOrderRepository } from "./drizzle-order-repository";

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

describe("order list by effective status", () => {
  it("filters derived overdue orders and keeps them out of their stored status", async () => {
    const orders = new DrizzleOrderRepository(db, ws);
    const overdue = await orders.list({ status: "overdue", asOf: now, pageSize: 100 });
    expect(overdue.total).toBeGreaterThan(0);
    expect(overdue.items.every((o) => effectiveOrderStatus(o, now) === "overdue")).toBe(true);

    const invoiced = await orders.list({ status: "invoiced", asOf: now, pageSize: 100 });
    expect(invoiced.items.every((o) => effectiveOrderStatus(o, now) === "invoiced")).toBe(true);

    const all = await orders.listSummaries();
    const expectedOverdue = all.filter((o) => effectiveOrderStatus(o, now) === "overdue").length;
    expect(overdue.total).toBe(expectedOverdue);
  });
});

describe("sales overview", () => {
  it("aggregates KPIs, tab counts and the next reference from storage", async () => {
    const overview = await makeGetSalesOverview({ orders: new DrizzleOrderRepository(db, ws), clock: () => now })();
    expect(overview.counts.all).toBeGreaterThanOrEqual(47);
    expect(overview.kpis.pipelineCents).toBeGreaterThan(0);
    expect(overview.weekly).toHaveLength(6);
    expect(overview.nextReference).toMatch(/^SL-\d+$/);
  });
});
