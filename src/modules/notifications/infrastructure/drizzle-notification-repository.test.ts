import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleMemberRepository } from "@/modules/team/infrastructure/drizzle-member-repository";
import type { Database } from "@/server/db/connect";
import { seedDatabase, type SeedSummary } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import {
  makeCountUnreadNotifications,
  makeListNotifications,
  makeMarkAllNotificationsRead,
  makeMarkNotificationRead,
  makeNotify,
} from "../application/use-cases";
import { DrizzleNotificationRepository } from "./drizzle-notification-repository";

const now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;
let seed: SeedSummary;
let maya: number;
let marcus: number;
let noah: number;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  seed = await seedDatabase(db, now);
  const northMembers = await new DrizzleMemberRepository(db, seed.workspaces.northstar).list();
  maya = northMembers.find((m) => m.name === "Maya Chen")!.id;
  marcus = northMembers.find((m) => m.name === "Marcus Miller")!.id;
  noah = (await new DrizzleMemberRepository(db, seed.workspaces.sandbox).list()).find((m) => m.name === "Noah Patel")!.id;
});
afterAll(() => cleanup());

let tick = 0;
function app(workspaceId: number) {
  // Strictly increasing clock so ordering by creation time is deterministic.
  const deps = { notifications: new DrizzleNotificationRepository(db, workspaceId), clock: () => new Date(now.getTime() + ++tick * 1000) };
  return {
    notify: makeNotify(deps),
    list: makeListNotifications(deps),
    unread: makeCountUnreadNotifications(deps),
    markRead: makeMarkNotificationRead(deps),
    markAllRead: makeMarkAllNotificationsRead(deps),
  };
}

describe("notifications", () => {
  it("notifies recipients except the actor, de-duplicated, with safe hrefs only", async () => {
    const north = app(seed.workspaces.northstar);
    const created = await north.notify({ recipientIds: [maya, maya, marcus, null], actorId: marcus, type: "task_assigned", title: "Task assigned", href: "/tasks?task=1" });
    expect(created).toBe(1);
    expect(await north.notify({ recipientIds: [marcus], actorId: marcus, type: "system", title: "Self" })).toBe(0);
    await north.notify({ recipientIds: [maya], type: "system", title: "External link", href: "https://evil.test" });
    const page = await north.list(maya);
    expect(page.items[0]).toMatchObject({ title: "External link", href: null });
    expect(page.items[1]).toMatchObject({ title: "Task assigned", href: "/tasks?task=1", readAt: null, recipientId: maya });
  });

  it("lists unread first, counts unread and marks read for the recipient only", async () => {
    const north = app(seed.workspaces.northstar);
    await north.markAllRead(maya);
    await north.notify({ recipientIds: [maya], type: "order_status", title: "Older unread" });
    await north.notify({ recipientIds: [maya], type: "order_status", title: "Newer read" });
    const before = await north.list(maya, { pageSize: 50 });
    const newer = before.items.find((n) => n.title === "Newer read")!;

    expect(await north.markRead(marcus, newer.id)).toBeNull(); // not Marcus's notification
    expect((await north.markRead(maya, newer.id))!.readAt).not.toBeNull();
    expect(await north.unread(maya)).toBe(1);

    const after = await north.list(maya, { pageSize: 50 });
    expect(after.items[0]!.title).toBe("Older unread");
    expect(after.items.findIndex((n) => n.title === "Newer read")).toBeGreaterThan(0);
    expect(after.total).toBe(before.total);

    expect(await north.markAllRead(maya)).toBe(1);
    expect(await north.unread(maya)).toBe(0);
  });

  it("paginates the recipient's notifications", async () => {
    const north = app(seed.workspaces.northstar);
    for (let i = 0; i < 3; i++) await north.notify({ recipientIds: [marcus], type: "system", title: `Note ${i}` });
    const first = await north.list(marcus, { page: 1, pageSize: 2 });
    const second = await north.list(marcus, { page: 2, pageSize: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.total).toBe(second.total);
    expect(second.items.some((n) => first.items.some((f) => f.id === n.id))).toBe(false);
  });

  it("isolates workspaces: foreign recipients are dropped and foreign ids are not found", async () => {
    const north = app(seed.workspaces.northstar);
    const sandbox = app(seed.workspaces.sandbox);
    expect(await north.notify({ recipientIds: [noah], type: "system", title: "Cross-tenant" })).toBe(0);
    await sandbox.notify({ recipientIds: [noah], type: "system", title: "Sandbox only" });
    const sandboxNote = (await sandbox.list(noah)).items[0]!;

    expect(await north.markRead(noah, sandboxNote.id)).toBeNull();
    expect(await north.unread(noah)).toBe(0);
    expect((await north.list(noah)).total).toBe(0);
    expect(await north.markAllRead(noah)).toBe(0);
    expect(await sandbox.unread(noah)).toBe(1);
  });

  it("seeds unread notifications for the demo user", async () => {
    const fresh = await createTestDatabase();
    try {
      const summary = await seedDatabase(fresh.db, now);
      const repo = new DrizzleNotificationRepository(fresh.db, summary.workspaces.northstar);
      expect(await repo.countUnread(summary.demoMembers.northstar)).toBeGreaterThan(0);
    } finally {
      fresh.cleanup();
    }
  });
});
