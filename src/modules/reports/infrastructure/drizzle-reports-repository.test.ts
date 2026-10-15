import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/db/connect";
import { seedDatabase } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import { makeGetReport } from "../application/use-cases";
import { DrizzleReportsRepository } from "./drizzle-reports-repository";

const now = new Date("2026-10-14T12:00:00Z");
const range = { start: new Date("2025-01-01T00:00:00Z"), end: new Date("2026-10-15T00:00:00Z") };
let db: Database;
let cleanup: () => void;
let ws: number;
let sandboxWs: number;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  const seeded = await seedDatabase(db, now);
  ws = seeded.workspaces.northstar;
  sandboxWs = seeded.workspaces.sandbox;
});
afterAll(() => cleanup());

describe("DrizzleReportsRepository", () => {
  it("returns order facts with paid totals for one workspace only", async () => {
    const northstar = await new DrizzleReportsRepository(db, ws).orderFacts();
    const sandbox = await new DrizzleReportsRepository(db, sandboxWs).orderFacts();
    expect(northstar.length).toBeGreaterThan(40);
    expect(sandbox.map((o) => o.customerCompany).sort()).toEqual(["Kite Learning", "Polaris Mobility", "Quanta Bioworks"]);
    const quanta = sandbox.find((o) => o.customerCompany === "Quanta Bioworks")!;
    expect(quanta.paidCents).toBe(quanta.amountCents);
    const ids = new Set(sandbox.map((o) => o.id));
    expect(northstar.some((o) => ids.has(o.id))).toBe(false);
  });

  it("scopes payments, tasks and time entries to the workspace and the range", async () => {
    const north = new DrizzleReportsRepository(db, ws);
    const sand = new DrizzleReportsRepository(db, sandboxWs);
    const [northPayments, sandPayments] = await Promise.all([north.paymentFacts(range), sand.paymentFacts(range)]);
    const sandOrderIds = new Set((await sand.orderFacts()).map((o) => o.id));
    expect(sandPayments.length).toBeGreaterThan(0);
    expect(sandPayments.every((p) => sandOrderIds.has(p.orderId))).toBe(true);
    expect(northPayments.some((p) => sandOrderIds.has(p.orderId))).toBe(false);
    expect(northPayments.length).toBeGreaterThan(sandPayments.length);
    expect(northPayments.every((p) => p.paidAt >= range.start && p.paidAt < range.end)).toBe(true);

    const [northTasks, sandTasks] = await Promise.all([north.taskFacts(), sand.taskFacts()]);
    expect(sandTasks).toHaveLength(3);
    expect(northTasks.length).toBeGreaterThan(10);

    const [northTime, sandTime] = await Promise.all([north.timeEntries(range), sand.timeEntries(range)]);
    expect(northTime.length).toBeGreaterThan(0);
    expect(northTime.every((e) => e.memberName !== null)).toBe(true);
    expect(sandTime).toHaveLength(0);
    const empty = await north.paymentFacts({ start: new Date("2000-01-01T00:00:00Z"), end: new Date("2000-02-01T00:00:00Z") });
    expect(empty).toHaveLength(0);
  });
});

describe("getReport", () => {
  it("aggregates every section from the workspace's data", async () => {
    const report = await makeGetReport({ reports: new DrizzleReportsRepository(db, ws), clock: () => now })({ preset: "last_12_months" });
    expect(report.range.preset).toBe("last_12_months");
    expect(report.revenue.months).toHaveLength(12);
    expect(report.revenue.billedCents).toBeGreaterThan(0);
    expect(report.categories.categories.reduce((s, c) => s + c.percent, 0)).toBe(100);
    expect(report.customers[0]!.billedCents).toBeGreaterThanOrEqual(report.customers.at(-1)!.billedCents);
    expect(report.aging.buckets.map((b) => b.bucket)).toEqual(["current", "1_30", "31_60", "61_90", "90_plus"]);
    expect(report.aging.totalCents).toBeGreaterThan(0);
    expect(report.pipeline.find((p) => p.status === "overdue")!.count).toBeGreaterThanOrEqual(2);
    expect(report.tasks.completedCount).toBeGreaterThan(0);
    expect(report.time.totalMinutes).toBeGreaterThan(0);

    const sandbox = await makeGetReport({ reports: new DrizzleReportsRepository(db, sandboxWs), clock: () => now })({ preset: "last_12_months" });
    expect(sandbox.customers.map((c) => c.company)).not.toContain("Hyperion Media Group");
  });
});
