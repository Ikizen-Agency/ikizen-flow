import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/db/connect";
import { orders as ordersTable } from "@/server/db/schema";
import { seedDatabase, type SeedSummary } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import { parseActivityParams } from "../application/params";
import { makeListActivity } from "../application/use-cases";
import { DrizzleActivityRepository } from "./drizzle-activity-repository";

const now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;
let seed: SeedSummary;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  seed = await seedDatabase(db, now);
});
afterAll(() => cleanup());

const feed = (ws = seed.workspaces.northstar) => makeListActivity({ activity: new DrizzleActivityRepository(db, ws) });

describe("activity feed", () => {
  it("pages the workspace's events newest first", async () => {
    const first = await feed()({ page: 1, pageSize: 3 });
    const second = await feed()({ page: 2, pageSize: 3 });
    expect(first.items).toHaveLength(3);
    expect(first.total).toBeGreaterThan(3);
    expect(first.items[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(first.items[2]!.createdAt.getTime());
    expect(second.items[0]!.id).not.toBe(first.items[0]!.id);
  });

  it("is scoped to the workspace", async () => {
    const north = await feed()({ page: 1, pageSize: 100 });
    const sandbox = await feed(seed.workspaces.sandbox)({ page: 1, pageSize: 100 });
    expect(sandbox.total).toBeGreaterThan(0);
    const northIds = new Set(north.items.map((e) => e.id));
    expect(sandbox.items.some((e) => northIds.has(e.id))).toBe(false);
  });

  it("filters by category, member and entity type", async () => {
    const billing = await feed()({ category: "billing", page: 1, pageSize: 100 });
    expect(billing.total).toBeGreaterThan(0);
    expect(billing.items.every((e) => e.category === "billing")).toBe(true);

    const alex = await feed()({ actorId: seed.demoMembers.northstar, page: 1, pageSize: 100 });
    expect(alex.total).toBeGreaterThan(0);
    expect(alex.items.every((e) => e.actorName === "Alex Vance")).toBe(true);

    const tasks = await feed()({ entityType: "task", page: 1, pageSize: 100 });
    expect(tasks.items.every((e) => e.entityType === "task")).toBe(true);
    expect(tasks.items.every((e) => e.href?.startsWith("/tasks?task="))).toBe(true);

    // A member of another workspace matches nothing here.
    expect((await feed()({ actorId: seed.demoMembers.sandbox, page: 1, pageSize: 100 })).total).toBe(0);
  });

  it("links orders to their sales reference", async () => {
    const ws = seed.workspaces.northstar;
    const [order] = await db.select({ id: ordersTable.id, reference: ordersTable.reference }).from(ordersTable).where(eq(ordersTable.workspaceId, ws)).limit(1);
    await new DrizzleActivityRepository(db, ws).record({ actorId: seed.demoMembers.northstar, message: "updated an order", category: "pipeline", entityType: "order", entityId: order!.id, createdAt: now });
    const orders = await feed()({ entityType: "order", page: 1, pageSize: 100 });
    expect(orders.items.find((e) => e.entityId === order!.id)?.href).toBe(`/sales?order=${order!.reference}`);
    expect(orders.items.length).toBeGreaterThan(0);
    expect(orders.items.every((e) => /^\/sales\?order=SL-\d+$/.test(e.href ?? ""))).toBe(true);
  });
});

describe("parseActivityParams", () => {
  it("reads filters and the page, ignoring invalid values", () => {
    expect(parseActivityParams({ category: "billing", member: "3", entity: "task", page: "2" })).toEqual({ category: "billing", actorId: 3, entityType: "task", page: 2 });
    expect(parseActivityParams({ category: "x", member: "y", entity: "invoice", page: "0" })).toEqual({ page: 1 });
  });
});
