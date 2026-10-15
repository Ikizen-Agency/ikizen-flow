import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/db/connect";
import { seedDatabase, type SeedSummary } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import type { Mailer } from "../application/ports";
import { makeListOutbox, makeSendEmail } from "../application/use-cases";
import { DrizzleEmailOutbox } from "./drizzle-email-outbox";

const now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;
let seed: SeedSummary;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  seed = await seedDatabase(db, now);
});
afterAll(() => cleanup());

const okTransport: Mailer = { transport: "smtp", deliver: async () => ({ status: "sent" }) };
const failingTransport: Mailer = {
  transport: "smtp",
  deliver: async () => {
    throw new Error("550 mailbox unavailable");
  },
};

describe("drizzle email outbox", () => {
  it("stores sent and failed deliveries in the workspace outbox", async () => {
    const outbox = new DrizzleEmailOutbox(db, seed.workspaces.sandbox);
    const deps = { outbox, clock: () => now };
    const sent = await makeSendEmail({ ...deps, mailer: okTransport })({ to: "iris@quantabio.com", subject: "Hello", text: "Body", kind: "campaign" });
    const failed = await makeSendEmail({ ...deps, mailer: failingTransport })({ to: "theo@polarismobility.eu", subject: "Hi", text: "Body", kind: "invoice" });

    expect(await outbox.findById(sent.id)).toMatchObject({ status: "sent", sentAt: now, error: null, kind: "campaign" });
    expect(await outbox.findById(failed.id)).toMatchObject({ status: "failed", sentAt: null, error: "550 mailbox unavailable" });
    const failedOnly = await makeListOutbox({ outbox })({ status: "failed" });
    expect(failedOnly.items.map((e) => e.to)).toEqual(["theo@polarismobility.eu"]);
  });

  it("never exposes another workspace's outbox entries", async () => {
    const sandbox = new DrizzleEmailOutbox(db, seed.workspaces.sandbox);
    const north = new DrizzleEmailOutbox(db, seed.workspaces.northstar);
    const mine = await makeSendEmail({ outbox: sandbox, mailer: okTransport, clock: () => now })({ to: "a@b.test", subject: "S", text: "T", kind: "invite" });
    expect(await north.findById(mine.id)).toBeNull();
    expect((await north.list({ pageSize: 100 })).items.some((e) => e.id === mine.id)).toBe(false);
    expect((await sandbox.list({ pageSize: 100 })).items.some((e) => e.id === mine.id)).toBe(true);
  });
});
