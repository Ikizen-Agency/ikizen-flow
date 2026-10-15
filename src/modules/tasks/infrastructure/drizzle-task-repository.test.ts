import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleActivityRepository } from "@/modules/activity/infrastructure/drizzle-activity-repository";
import type { Database } from "@/server/db/connect";
import { seedDatabase } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import { makeAddSubtask, makeGetTaskDetail, makeMoveTask, makeToggleSubtask } from "../application/use-cases";
import { DrizzleTaskRepository } from "./drizzle-task-repository";

const now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;
/** Northstar Studio, the workspace holding the design dataset. */
let ws: number;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  ws = (await seedDatabase(db, now)).workspaces.northstar;
});
afterAll(() => cleanup());

const deps = () => ({ tasks: new DrizzleTaskRepository(db, ws), activity: new DrizzleActivityRepository(db, ws), clock: () => now });

describe("task board storage", () => {
  it("filters open tasks by due window", async () => {
    const repo = new DrizzleTaskRepository(db, ws);
    const all = await repo.listBoard({});
    const open = await repo.listBoard({ openOnly: true, dueBefore: now });
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((t) => t.status !== "completed" && t.dueAt !== null && t.dueAt <= now)).toBe(true);
    expect(all.some((t) => t.status === "completed" && t.dueAt !== null && t.dueAt <= now)).toBe(true);
    expect(all.every((t) => t.updatedAt instanceof Date)).toBe(true);
  });
});

describe("task detail use cases", () => {
  it("toggles and adds subtasks on the right task only", async () => {
    const repo = new DrizzleTaskRepository(db, ws);
    const [withSubtasks] = (await repo.listBoard({})).filter((t) => t.subtasks.length > 0);
    const target = withSubtasks!.subtasks.find((s) => !s.done)!;

    await makeToggleSubtask(deps())(withSubtasks!.id, target.id, true);
    await makeAddSubtask(deps())(withSubtasks!.id, "Final QA pass");
    const updated = (await repo.findById(withSubtasks!.id))!;
    expect(updated.subtasks.find((s) => s.id === target.id)?.done).toBe(true);
    expect(updated.subtasks.at(-1)).toMatchObject({ title: "Final QA pass", done: false });

    const other = (await repo.listBoard({})).find((t) => t.id !== withSubtasks!.id)!;
    await expect(makeToggleSubtask(deps())(other.id, target.id, false)).rejects.toThrow(/not found/i);
  });

  it("records moves in the task timeline", async () => {
    const repo = new DrizzleTaskRepository(db, ws);
    const [first] = await repo.listBoard({ priority: "low" });
    await makeMoveTask(deps())(first!.id, "in_progress");

    const detail = await makeGetTaskDetail(deps())(first!.id);
    expect(detail?.task.status).toBe("in_progress");
    expect(detail?.activity[0]?.message).toMatch(/^moved /);
    expect(await makeGetTaskDetail(deps())(999_999)).toBeNull();
  });
});
