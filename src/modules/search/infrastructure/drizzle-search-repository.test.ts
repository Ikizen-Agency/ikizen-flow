import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/db/connect";
import { seedDatabase, type SeedSummary } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import { likePattern, normalizeSearchQuery } from "../domain/search";
import { makeGlobalSearch } from "../application/use-cases";
import { DrizzleSearchRepository } from "./drizzle-search-repository";

const now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;
let seed: SeedSummary;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  seed = await seedDatabase(db, now);
});
afterAll(() => cleanup());

const searchIn = (workspaceId: number) => makeGlobalSearch({ search: new DrizzleSearchRepository(db, workspaceId) });

describe("search query helpers", () => {
  it("normalizes queries and escapes LIKE wildcards", () => {
    expect(normalizeSearchQuery("  a ")).toBeNull();
    expect(normalizeSearchQuery("  acme   corp ")).toBe("acme corp");
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});

describe("global search", () => {
  it("finds customers by company or contact, orders by reference/invoice/title and tasks by code/title", async () => {
    const search = searchIn(seed.workspaces.northstar);
    expect((await search("acme")).customers.map((c) => c.company)).toContain("Acme Logistics Corp");
    expect((await search("sarah jenkins")).customers.map((c) => c.company)).toEqual(["Apex Digital Labs"]);
    expect((await search("SL-1048")).orders.map((o) => o.reference)).toEqual(["SL-1048"]);
    expect((await search("task-842")).tasks.map((t) => t.code)).toEqual(["TASK-842"]);
    expect((await search("kubernetes")).tasks.map((t) => t.code)).toContain("TASK-839");
  });

  it("is scoped to the workspace", async () => {
    const north = await searchIn(seed.workspaces.northstar)("quanta");
    const sandbox = await searchIn(seed.workspaces.sandbox)("quanta");
    expect(north.customers).toEqual([]);
    expect(north.orders).toEqual([]);
    expect(sandbox.customers.map((c) => c.company)).toEqual(["Quanta Bioworks"]);

    // Both workspaces have an SL-1002; each only sees its own.
    const sandboxOrder = (await searchIn(seed.workspaces.sandbox)("SL-1002")).orders;
    const northOrder = (await searchIn(seed.workspaces.northstar)("SL-1002")).orders;
    expect(sandboxOrder).toHaveLength(1);
    expect(northOrder).toHaveLength(1);
    expect(sandboxOrder[0]!.customerCompany).not.toBe(northOrder[0]!.customerCompany);
    expect((await searchIn(seed.workspaces.sandbox)("apex")).customers).toEqual([]);
  });

  it("limits each group and treats wildcards literally", async () => {
    const search = searchIn(seed.workspaces.northstar);
    expect((await search("SL-", 3)).orders).toHaveLength(3);
    expect(await search("%%")).toMatchObject({ customers: [], orders: [], tasks: [] });
    expect(await search("x")).toMatchObject({ customers: [], orders: [], tasks: [] });
  });
});
