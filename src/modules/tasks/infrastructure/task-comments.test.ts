import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleActivityRepository } from "@/modules/activity/infrastructure/drizzle-activity-repository";
import { makeNotify } from "@/modules/notifications/application/use-cases";
import { DrizzleNotificationRepository } from "@/modules/notifications/infrastructure/drizzle-notification-repository";
import { DrizzleMemberRepository } from "@/modules/team/infrastructure/drizzle-member-repository";
import type { Database } from "@/server/db/connect";
import { seedDatabase, type SeedSummary } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import { makeAddTaskComment, makeDeleteTaskComment, makeEditTaskComment, makeListTaskComments } from "../application/comment-use-cases";
import { CommentPermissionError, mentionToken } from "../domain/comment";
import { DrizzleTaskCommentRepository } from "./drizzle-task-comment-repository";
import { DrizzleTaskRepository } from "./drizzle-task-repository";

const now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;
let seed: SeedSummary;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  seed = await seedDatabase(db, now);
});
afterAll(() => cleanup());

const deps = (ws: number) => {
  const notifications = new DrizzleNotificationRepository(db, ws);
  return {
    tasks: new DrizzleTaskRepository(db, ws),
    taskComments: new DrizzleTaskCommentRepository(db, ws),
    activity: new DrizzleActivityRepository(db, ws),
    notifications,
    clock: () => now,
    notify: makeNotify({ notifications, clock: () => now }),
  };
};
const north = () => deps(seed.workspaces.northstar);
const sandbox = () => deps(seed.workspaces.sandbox);

const member = async (ws: number, name: string) => (await new DrizzleMemberRepository(db, ws).list()).find((m) => m.name === name)!;
const mentionTitles = async (recipientId: number) =>
  (await north().notifications.listForRecipient(recipientId, { page: 1, pageSize: 50 })).items.filter((n) => n.type === "mention").map((n) => n.href);

describe("task comments", () => {
  it("seeds real comments and derives the card counter from them", async () => {
    const d = north();
    const task = (await d.tasks.listBoard({})).find((t) => t.commentCount > 0)!;
    expect(await makeListTaskComments(d)(task.id)).toHaveLength(task.commentCount);
  });

  it("adds a comment, bumps the counter and records activity", async () => {
    const d = north();
    const [task] = await d.tasks.listBoard({ priority: "low" });
    const comment = await makeAddTaskComment(d)(task!.id, "  Kickoff scheduled  ", seed.demoMembers.northstar);
    expect(comment).toMatchObject({ body: "Kickoff scheduled", authorId: seed.demoMembers.northstar, editedAt: null });
    expect((await d.tasks.findById(task!.id))?.commentCount).toBe(task!.commentCount + 1);
    expect((await d.activity.forEntity("task", task!.id, 1))[0]?.message).toBe(`commented on ${task!.title}`);
  });

  it("notifies mentioned members with a link to the task, never the author or outsiders", async () => {
    const d = north();
    const alex = seed.demoMembers.northstar;
    const maya = await member(seed.workspaces.northstar, "Maya Chen");
    const outsider = await member(seed.workspaces.sandbox, "Alex Vance");
    const [task] = await d.tasks.listBoard({ priority: "high" });
    const body = `${mentionToken(maya)} ${mentionToken({ id: alex, name: "Alex Vance" })} ${mentionToken(outsider)} please review`;

    const before = (await mentionTitles(alex)).length;
    await makeAddTaskComment(d)(task!.id, body, alex);
    expect(await mentionTitles(maya.id)).toContain(`/tasks?task=${task!.id}`);
    expect((await mentionTitles(alex)).length).toBe(before);
    const outsiderInbox = await sandbox().notifications.listForRecipient(outsider.id, { page: 1, pageSize: 50 });
    expect(outsiderInbox.items.some((n) => n.type === "mention")).toBe(false);
  });

  it("lets only the author edit or delete, and notifies only newly added mentions", async () => {
    const d = north();
    const alex = seed.demoMembers.northstar;
    const maya = await member(seed.workspaces.northstar, "Maya Chen");
    const elena = await member(seed.workspaces.northstar, "Elena Ramos");
    const [task] = await d.tasks.listBoard({ priority: "medium" });
    const comment = await makeAddTaskComment(d)(task!.id, `${mentionToken(maya)} first pass`, alex);
    const mayaBefore = (await mentionTitles(maya.id)).length;

    await expect(makeEditTaskComment(d)(comment.id, "hijack", maya.id)).rejects.toThrow(CommentPermissionError);
    await expect(makeDeleteTaskComment(d)(comment.id, maya.id)).rejects.toThrow(CommentPermissionError);

    const edited = await makeEditTaskComment(d)(comment.id, `${mentionToken(maya)} ${mentionToken(elena)} second pass`, alex);
    expect(edited.editedAt).toEqual(now);
    expect((await mentionTitles(maya.id)).length).toBe(mayaBefore);
    expect(await mentionTitles(elena.id)).toContain(`/tasks?task=${task!.id}`);

    await makeDeleteTaskComment(d)(comment.id, alex);
    expect((await makeListTaskComments(d)(task!.id)).some((c) => c.id === comment.id)).toBe(false);
  });
});

describe("workspace scoping of comments", () => {
  it("rejects comments on, and edits of, another workspace's data", async () => {
    const d = north();
    const [task] = await d.tasks.listBoard({});
    const comment = await makeAddTaskComment(d)(task!.id, "Internal note", seed.demoMembers.northstar);
    const s = sandbox();
    await expect(makeAddTaskComment(s)(task!.id, "Sneaky", seed.demoMembers.sandbox)).rejects.toThrow(/not found/i);
    await expect(makeEditTaskComment(s)(comment.id, "Sneaky", seed.demoMembers.northstar)).rejects.toThrow(/not found/i);
    await expect(makeDeleteTaskComment(s)(comment.id, seed.demoMembers.northstar)).rejects.toThrow(/not found/i);
    expect(await makeListTaskComments(s)(task!.id)).toEqual([]);
    expect((await makeListTaskComments(d)(task!.id)).find((c) => c.id === comment.id)?.body).toBe("Internal note");
  });
});
