import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createTestDatabase } from "@/test/test-database";
import type { Database } from "./connect";
import { orders, payments } from "./schema";
import { seedDatabase } from "./seed/seed";

const now = new Date("2026-10-14T12:00:00Z");
const backfill = readFileSync(join(process.cwd(), "drizzle/0007_backfill_completed_payments.sql"), "utf8");
let db: Database;
let cleanup: () => void;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  await seedDatabase(db, now);
});
afterAll(() => cleanup());

const runBackfill = () => db.run(sql.raw(backfill));

describe("migration 0007: payments backfill for completed orders", () => {
  it("adds one payment equal to the total for completed orders recorded before payments existed, and is idempotent", async () => {
    const completed = await db.select().from(orders).where(eq(orders.status, "completed")).limit(2);
    expect(completed).toHaveLength(2);
    const [withPaidAt, withoutPaidAt] = completed as [(typeof completed)[0], (typeof completed)[0]];
    // Simulate rows that predate the payments table: no payments, and one without a paid date.
    await db.delete(payments).where(inArray(payments.orderId, [withPaidAt.id, withoutPaidAt.id]));
    await db.update(orders).set({ paidAt: null }).where(eq(orders.id, withoutPaidAt.id));
    const before = await db.select({ n: sql<number>`count(*)` }).from(payments);

    await runBackfill();
    await runBackfill();

    const after = await db.select({ n: sql<number>`count(*)` }).from(payments);
    expect(after[0]!.n - before[0]!.n).toBe(2);
    const [first] = await db.select().from(payments).where(eq(payments.orderId, withPaidAt.id));
    expect(first).toMatchObject({ workspaceId: withPaidAt.workspaceId, amountCents: withPaidAt.amountCents, paidAt: withPaidAt.paidAt, method: "other" });
    const [second] = await db.select().from(payments).where(and(eq(payments.orderId, withoutPaidAt.id)));
    expect(second).toMatchObject({ amountCents: withoutPaidAt.amountCents, paidAt: withoutPaidAt.issueDate });
  });
});
