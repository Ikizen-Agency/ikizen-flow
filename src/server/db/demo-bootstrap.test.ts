import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalAttachmentStorage } from "@/modules/tasks/infrastructure/local-attachment-storage";
import { createDatabase } from "./connect";
import { bootstrapDemoDatabase, gateClient, once } from "./demo-bootstrap";
import { customers, user } from "./schema";

const dirs: string[] = [];
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "ikizen-demo-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("bootstrapDemoDatabase", () => {
  it("migrates and seeds an empty database once, then leaves existing data alone", async () => {
    const dir = tempDir();
    const { db, client } = createDatabase(`file:${join(dir, "demo.db")}`);
    const attachmentStorage = new LocalAttachmentStorage(join(dir, "uploads"));
    const options = { migrationsFolder: "./drizzle", attachmentStorage, now: new Date("2026-10-14T12:00:00Z") };

    expect(await bootstrapDemoDatabase(db, options)).toEqual({ seeded: true });
    const firstUsers = await db.select({ id: user.id }).from(user);
    const customerCount = (await db.select({ id: customers.id }).from(customers)).length;
    expect(firstUsers).toHaveLength(1);
    expect(customerCount).toBeGreaterThan(0);
    expect(readdirSync(join(dir, "uploads")).length).toBeGreaterThan(0);

    expect(await bootstrapDemoDatabase(db, options)).toEqual({ seeded: false });
    expect(await db.select({ id: user.id }).from(user)).toEqual(firstUsers);
    expect(await db.select({ id: customers.id }).from(customers)).toHaveLength(customerCount);
    client.close();
  }, 30_000);
});

describe("once", () => {
  it("shares one in-flight run between concurrent callers and retries after a failure", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
    const ready = once(run);
    await expect(Promise.all([ready(), ready()])).rejects.toThrow("boom");
    expect(run).toHaveBeenCalledTimes(1);
    await Promise.all([ready(), ready(), ready()]);
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("gateClient", () => {
  it("waits for the gate before every database call", async () => {
    const dir = tempDir();
    const { client } = createDatabase(`file:${join(dir, "gate.db")}`);
    const order: string[] = [];
    const gated = gateClient(client, async () => {
      order.push("gate");
    });
    const result = await gated.execute("select 1 as one");
    order.push("query");
    expect(result.rows[0]?.one).toBe(1);
    expect(order).toEqual(["gate", "query"]);
    expect(gated.closed).toBe(false);
    client.close();
  });
});
