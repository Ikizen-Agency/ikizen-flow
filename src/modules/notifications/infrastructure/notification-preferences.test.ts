import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeSendEmail } from "@/modules/mail/application/use-cases";
import { DrizzleEmailOutbox } from "@/modules/mail/infrastructure/drizzle-email-outbox";
import { DrizzleMemberRepository } from "@/modules/team/infrastructure/drizzle-member-repository";
import type { Database } from "@/server/db/connect";
import { seedDatabase, type SeedSummary } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import { makeGetNotificationPreferences, makeListNotifications, makeNotify, makeSaveNotificationPreferences } from "../application/use-cases";
import { NOTIFICATION_TYPES } from "../domain/notification";
import { DrizzleNotificationPreferenceRepository } from "./drizzle-notification-preference-repository";
import { DrizzleNotificationRepository } from "./drizzle-notification-repository";

const now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;
let seed: SeedSummary;
let alex: number;
let maya: number;
let marcus: number;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  seed = await seedDatabase(db, now);
  const people = await new DrizzleMemberRepository(db, seed.workspaces.northstar).list();
  alex = seed.demoMembers.northstar;
  maya = people.find((m) => m.name === "Maya Chen")!.id;
  marcus = people.find((m) => m.name === "Marcus Miller")!.id;
});
afterAll(() => cleanup());

function deps(transport: "ok" | "fail" = "ok") {
  const ws = seed.workspaces.northstar;
  const notifications = new DrizzleNotificationRepository(db, ws);
  const preferences = new DrizzleNotificationPreferenceRepository(db, ws);
  const outbox = new DrizzleEmailOutbox(db, ws);
  const mailer = {
    transport: "smtp" as const,
    deliver: async () => {
      if (transport === "fail") throw new Error("SMTP down");
      return { status: "sent" as const };
    },
  };
  const sendEmail = makeSendEmail({ outbox, mailer, clock: () => now });
  return {
    notify: makeNotify({ notifications, preferences, sendEmail, baseUrl: "https://app.test/", clock: () => now }),
    getPrefs: makeGetNotificationPreferences({ preferences }),
    savePrefs: makeSaveNotificationPreferences({ preferences }),
    inbox: (id: number) => makeListNotifications({ notifications })(id, { pageSize: 50 }),
    outbox,
  };
}

describe("notification preferences", () => {
  it("default to in-app on and email off for every type", async () => {
    const prefs = await deps().getPrefs(maya);
    expect(prefs.map((p) => p.type)).toEqual([...NOTIFICATION_TYPES]);
    expect(prefs.every((p) => p.inApp && !p.email)).toBe(true);
  });

  it("are saved per member and type", async () => {
    await deps().savePrefs(maya, [
      { type: "task_assigned", inApp: false, email: false },
      { type: "mention", inApp: true, email: true },
    ]);
    const prefs = await deps().getPrefs(maya);
    expect(prefs.find((p) => p.type === "task_assigned")).toMatchObject({ inApp: false, email: false });
    expect(prefs.find((p) => p.type === "mention")).toMatchObject({ inApp: true, email: true });
    expect((await deps().getPrefs(marcus)).find((p) => p.type === "task_assigned")).toMatchObject({ inApp: true });
  });

  it("notify skips members who turned the in-app notification off", async () => {
    const { notify, inbox } = deps();
    const before = (await inbox(maya)).total;
    const created = await notify({ recipientIds: [maya, marcus], actorId: alex, type: "task_assigned", title: "New task for you" });
    expect(created).toBe(1);
    expect((await inbox(maya)).total).toBe(before);
    expect((await inbox(marcus)).items[0]).toMatchObject({ title: "New task for you" });
  });

  it("notify also emails members who turned the email on, with an absolute link", async () => {
    const { notify, outbox } = deps();
    await notify({ recipientIds: [maya, marcus], actorId: alex, type: "mention", title: "Alex mentioned you", body: "On DEV-12", href: "/tasks?task=3" });
    const emails = (await outbox.list({ kind: "notification" })).items;
    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({ to: "maya@northstar.studio", subject: "Alex mentioned you", status: "sent", createdById: alex });
    expect(emails[0]!.text).toContain("https://app.test/tasks?task=3");
  });

  it("a failing email never breaks the notification", async () => {
    const { notify, inbox } = deps("fail");
    const created = await notify({ recipientIds: [maya], actorId: alex, type: "mention", title: "Second mention" });
    expect(created).toBe(1);
    expect((await inbox(maya)).items.some((n) => n.title === "Second mention")).toBe(true);
  });

  it("ignores unknown types and members of other workspaces", async () => {
    await deps().savePrefs(maya, [{ type: "bogus" as never, inApp: false, email: false }]);
    expect((await deps().getPrefs(maya)).some((p) => (p.type as string) === "bogus")).toBe(false);
    expect(await deps().notify({ recipientIds: [seed.demoMembers.sandbox], actorId: alex, type: "system", title: "x" })).toBe(0);
  });
});
