import { describe, expect, it } from "vitest";
import { addSubtaskSchema, createTaskSchema, moveTaskSchema, taskCommentSchema, toggleSubtaskSchema } from "./form-schema";

describe("createTaskSchema", () => {
  it("normalizes a complete form into a task", () => {
    const parsed = createTaskSchema.parse({
      title: "  Ship beta  ",
      description: "Notes",
      status: "in_progress",
      priority: "high",
      customerId: "4",
      assigneeId: "2",
      dueDate: "2026-10-20",
      dueTime: "09:30",
      estimateHours: "12",
      tags: "Launch, QA ,, launch",
      subtasks: "Write notes\n\n  Deploy  \n",
    });
    expect(parsed).toEqual({
      title: "Ship beta",
      description: "Notes",
      status: "in_progress",
      priority: "high",
      customerId: 4,
      assigneeId: 2,
      dueAt: new Date("2026-10-20T09:30"),
      estimateHours: 12,
      tags: ["Launch", "QA"],
      subtasks: ["Write notes", "Deploy"],
    });
  });

  it("treats optional fields as empty and defaults the due time to 5 PM", () => {
    const parsed = createTaskSchema.parse({ title: "Quick", status: "todo", priority: "medium", customerId: "internal", dueDate: "2026-10-20" });
    expect(parsed).toMatchObject({
      description: null,
      customerId: null,
      assigneeId: null,
      dueAt: new Date("2026-10-20T17:00"),
      estimateHours: null,
      tags: [],
      subtasks: [],
    });
  });

  it("rejects a missing title, unknown enums and bad numbers", () => {
    const result = createTaskSchema.safeParse({ title: " ", status: "done", priority: "asap", estimateHours: "-3", dueDate: "20/10/2026" });
    expect(result.success).toBe(false);
    const fields = Object.keys(result.error?.flatten().fieldErrors ?? {});
    expect(fields).toEqual(expect.arrayContaining(["title", "status", "priority", "estimateHours", "dueDate"]));
  });
});

describe("task mutation schemas", () => {
  it("validates moves", () => {
    expect(moveTaskSchema.parse({ taskId: "3", status: "blocked" })).toEqual({ taskId: 3, status: "blocked" });
    expect(moveTaskSchema.safeParse({ taskId: "3", status: "archived" }).success).toBe(false);
    expect(moveTaskSchema.safeParse({ taskId: "0", status: "todo" }).success).toBe(false);
  });

  it("validates subtask and comment payloads", () => {
    expect(toggleSubtaskSchema.parse({ taskId: "1", subtaskId: "9", done: "true" })).toEqual({ taskId: 1, subtaskId: 9, done: true });
    expect(toggleSubtaskSchema.parse({ taskId: "1", subtaskId: "9", done: "false" }).done).toBe(false);
    expect(addSubtaskSchema.safeParse({ taskId: "1", title: "  " }).success).toBe(false);
    expect(taskCommentSchema.parse({ taskId: "1", body: "  Looks good  " })).toEqual({ taskId: 1, body: "Looks good" });
    expect(taskCommentSchema.safeParse({ taskId: "1", body: "x".repeat(1001) }).success).toBe(false);
  });
});
