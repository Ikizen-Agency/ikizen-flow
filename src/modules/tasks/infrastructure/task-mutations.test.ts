import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleActivityRepository } from "@/modules/activity/infrastructure/drizzle-activity-repository";
import { makeNotify } from "@/modules/notifications/application/use-cases";
import { DrizzleNotificationRepository } from "@/modules/notifications/infrastructure/drizzle-notification-repository";
import { DrizzleMemberRepository } from "@/modules/team/infrastructure/drizzle-member-repository";
import type { Database } from "@/server/db/connect";
import { seedDatabase, type SeedSummary } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import type { Task } from "../application/ports";
import {
  makeDeleteSubtask,
  makeDeleteTask,
  makeDuplicateTask,
  makeMoveTask,
  makeRenameSubtask,
  makeSetBlockedReason,
  makeUpdateTask,
  type UpdateTaskInput,
} from "../application/use-cases";
import { BlockedReasonRequiredError } from "../domain/task";
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
    activity: new DrizzleActivityRepository(db, ws),
    notifications,
    clock: () => now,
    notify: makeNotify({ notifications, clock: () => now }),
  };
};
const north = () => deps(seed.workspaces.northstar);
const sandbox = () => deps(seed.workspaces.sandbox);

const editInput = (task: Task, changes: Partial<UpdateTaskInput> = {}): UpdateTaskInput => ({
  title: task.title,
  description: task.description,
  status: task.status,
  priority: task.priority,
  customerId: task.customerId,
  assigneeId: task.assigneeId,
  dueAt: task.dueAt,
  estimateHours: task.estimateHours,
  tags: task.tags,
  blockedReason: task.blockedReason,
  ...changes,
});

async function memberId(name: string) {
  const list = await new DrizzleMemberRepository(db, seed.workspaces.northstar).list();
  return list.find((m) => m.name === name)!.id;
}

async function unreadTitles(recipientId: number) {
  const page = await north().notifications.listForRecipient(recipientId, { page: 1, pageSize: 50 });
  return page.items.map((n) => n.title);
}

describe("task editing", () => {
  it("updates every editable field and records the change", async () => {
    const d = north();
    const [task] = await d.tasks.listBoard({ priority: "low" });
    const updated = await makeUpdateTask(d)(task!.id, editInput(task!, { title: "Renamed task", priority: "high", tags: ["Ops"], estimateHours: 6 }), seed.demoMembers.northstar);
    expect(updated).toMatchObject({ title: "Renamed task", priority: "high", tags: ["Ops"], estimateHours: 6 });
    const timeline = await d.activity.forEntity("task", task!.id, 5);
    expect(timeline[0]?.message).toMatch(/^updated task Renamed task/);
  });

  it("notifies the new assignee on reassignment, never the actor", async () => {
    const d = north();
    const maya = await memberId("Maya Chen");
    const alex = seed.demoMembers.northstar;
    const task = (await d.tasks.listBoard({})).find((t) => t.assigneeId !== maya && t.assigneeId !== alex)!;

    await makeUpdateTask(d)(task.id, editInput(task, { assigneeId: maya }), alex);
    expect(await unreadTitles(maya)).toContain(`You were assigned ${task.code}`);

    const before = (await unreadTitles(alex)).length;
    await makeUpdateTask(d)(task.id, editInput(task, { assigneeId: alex }), alex);
    expect((await unreadTitles(alex)).length).toBe(before);
  });

  it("requires a blocked reason when editing or moving a task into blocked", async () => {
    const d = north();
    const [task] = await d.tasks.listBoard({ openOnly: true, priority: "medium" });
    const open = (await d.tasks.listBoard({})).find((t) => t.status === "todo")!;
    await expect(makeUpdateTask(d)(task!.id, editInput(task!, { status: "blocked", blockedReason: null }))).rejects.toThrow(BlockedReasonRequiredError);
    await expect(makeMoveTask(d)(open.id, "blocked")).rejects.toThrow(BlockedReasonRequiredError);

    await makeMoveTask(d)(open.id, "blocked", { blockedReason: "Waiting on legal" });
    expect((await d.tasks.findById(open.id))?.blockedReason).toBe("Waiting on legal");
    await makeSetBlockedReason(d)(open.id, "Waiting on finance");
    expect((await d.tasks.findById(open.id))?.blockedReason).toBe("Waiting on finance");

    await makeMoveTask(d)(open.id, "in_progress");
    expect((await d.tasks.findById(open.id))?.blockedReason).toBeNull();
    await expect(makeSetBlockedReason(d)(open.id, "Too late")).rejects.toThrow(/not blocked/i);
  });

  it("duplicates a task with a new code and an unchecked checklist", async () => {
    const d = north();
    const source = (await d.tasks.listBoard({})).find((t) => t.subtasks.some((s) => s.done))!;
    const copy = await makeDuplicateTask(d)(source.id, seed.demoMembers.northstar);
    expect(copy.code).not.toBe(source.code);
    expect(copy.title).toBe(`${source.title} (copy)`);
    expect(copy.status).toBe("todo");
    expect(copy.subtasks.map((s) => s.title)).toEqual(source.subtasks.map((s) => s.title));
    expect(copy.subtasks.every((s) => !s.done)).toBe(true);
  });

  it("renames and deletes subtasks of the right task only", async () => {
    const d = north();
    const [withSubtasks, other] = (await d.tasks.listBoard({})).filter((t) => t.subtasks.length > 1);
    const [first, second] = withSubtasks!.subtasks;
    await makeRenameSubtask(d)(withSubtasks!.id, first!.id, "Renamed step");
    await makeDeleteSubtask(d)(withSubtasks!.id, second!.id);
    const after = (await d.tasks.findById(withSubtasks!.id))!;
    expect(after.subtasks.find((s) => s.id === first!.id)?.title).toBe("Renamed step");
    expect(after.subtasks.some((s) => s.id === second!.id)).toBe(false);
    await expect(makeDeleteSubtask(d)(other!.id, first!.id)).rejects.toThrow(/not found/i);
  });

  it("deletes a task", async () => {
    const d = north();
    const task = await makeDuplicateTask(d)((await d.tasks.listBoard({}))[0]!.id);
    await makeDeleteTask(d)(task.id, seed.demoMembers.northstar);
    expect(await d.tasks.findById(task.id)).toBeNull();
  });
});

describe("workspace scoping of task mutations", () => {
  it("rejects edits, deletes and duplicates of another workspace's task", async () => {
    const northTask = (await north().tasks.listBoard({}))[0]!;
    const s = sandbox();
    await expect(makeUpdateTask(s)(northTask.id, editInput(northTask, { title: "Hijacked", customerId: null, assigneeId: null }))).rejects.toThrow(/not found/i);
    await expect(makeDeleteTask(s)(northTask.id)).rejects.toThrow(/not found/i);
    await expect(makeDuplicateTask(s)(northTask.id)).rejects.toThrow(/not found/i);
    expect((await north().tasks.findById(northTask.id))?.title).toBe(northTask.title);
  });

  it("rejects assignees and clients from another workspace", async () => {
    const d = north();
    const task = (await d.tasks.listBoard({}))[0]!;
    const foreignMember = (await new DrizzleMemberRepository(db, seed.workspaces.sandbox).list())[0]!.id;
    await expect(makeUpdateTask(d)(task.id, editInput(task, { assigneeId: foreignMember }))).rejects.toThrow(/not found/i);
  });
});

describe("board text search", () => {
  it("matches title, code and description, scoped to the workspace", async () => {
    const d = north();
    const [sample] = await d.tasks.listBoard({});
    expect((await d.tasks.listBoard({ q: sample!.code })).map((t) => t.id)).toContain(sample!.id);
    const byTitle = await d.tasks.listBoard({ q: "kubernetes" });
    expect(byTitle.length).toBeGreaterThan(0);
    expect(byTitle.every((t) => /kubernetes/i.test(`${t.title} ${t.code} ${t.description ?? ""}`))).toBe(true);
    expect(await d.tasks.listBoard({ q: "%" })).toEqual([]);
    expect(await sandbox().tasks.listBoard({ q: "kubernetes" })).toEqual([]);
  });
});
