import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/modules/workspaces/domain/permissions";
import type { Database } from "@/server/db/connect";
import { seedDatabase, type SeedSummary } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import { DrizzleMemberRepository } from "../../team/infrastructure/drizzle-member-repository";
import type { Mailer } from "../application/ports";
import { makeGetOutboxEmail, makeListOutbox, makeRetryEmail, makeSendEmail, makeSendTestEmail } from "../application/use-cases";
import { EmailRetryError } from "../domain/email";
import { DrizzleEmailOutbox } from "./drizzle-email-outbox";

const now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;
let seed: SeedSummary;
let failing = true;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  seed = await seedDatabase(db, now);
});
afterAll(() => cleanup());

const mailer: Mailer = {
  transport: "smtp",
  async deliver() {
    if (failing) throw new Error("connect ECONNREFUSED");
    return { status: "sent" };
  },
};
function deps(workspaceId = seed.workspaces.northstar) {
  const outbox = new DrizzleEmailOutbox(db, workspaceId);
  return { outbox, mailer, clock: () => now, members: new DrizzleMemberRepository(db, workspaceId), sendEmail: makeSendEmail({ outbox, mailer, clock: () => now }) };
}
const admin = { role: "admin" as const, memberId: 1 };
const member = { role: "member" as const, memberId: 1 };

describe("outbox administration", () => {
  it("lists, filters and shows emails to owners and admins only", async () => {
    const page = await makeListOutbox(deps())(admin, { page: 1, pageSize: 10 });
    expect(page.total).toBeGreaterThan(0);
    const one = await makeGetOutboxEmail(deps())(admin, page.items[0]!.id);
    expect(one?.id).toBe(page.items[0]!.id);
    await expect(makeListOutbox(deps())(member, {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(makeGetOutboxEmail(deps())(member, page.items[0]!.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await makeGetOutboxEmail(deps(seed.workspaces.sandbox))(admin, page.items[0]!.id)).toBeNull();
  });

  it("sends a test email only to the acting member's own address and records the outcome", async () => {
    const self = { role: "admin" as const, memberId: seed.demoMembers.northstar };
    const email = await makeSendTestEmail(deps())(self);
    expect(email).toMatchObject({ kind: "test", to: "alex@northstar.studio", status: "failed" });
    await expect(makeSendTestEmail(deps())({ ...self, role: "member" })).rejects.toBeInstanceOf(ForbiddenError);
    // A member of another workspace is not found here, so nothing is sent.
    await expect(makeSendTestEmail(deps())({ role: "admin", memberId: seed.demoMembers.sandbox })).rejects.toThrow(/not found/i);
  });

  it("retries failed emails only, recording the new outcome", async () => {
    const [failed] = (await makeListOutbox(deps())(admin, { status: "failed" })).items;
    failing = false;
    const retried = await makeRetryEmail(deps())(admin, failed!.id);
    expect(retried).toMatchObject({ id: failed!.id, status: "sent", error: null });
    expect(retried.sentAt).toEqual(now);
    await expect(makeRetryEmail(deps())(admin, failed!.id)).rejects.toBeInstanceOf(EmailRetryError);
    await expect(makeRetryEmail(deps())(member, failed!.id)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
