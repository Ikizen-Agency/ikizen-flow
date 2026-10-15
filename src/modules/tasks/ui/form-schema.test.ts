import { describe, expect, it } from "vitest";
import { addSubtaskSchema, createTaskSchema, logTimeSchema, moveTaskSchema, taskCommentSchema, toggleSubtaskSchema, updateTaskSchema } from "./form-schema";

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
    expect(taskCommentSchema.safeParse({ taskId: "1", body: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("updateTaskSchema", () => {
  const form = { taskId: "3", title: "Ship", status: "todo", priority: "low", customerId: "internal", assigneeId: "" };

  it("parses the edit form without subtasks", () => {
    expect(updateTaskSchema.parse({ ...form, blockedReason: "ignored" })).toMatchObject({
      taskId: 3,
      title: "Ship",
      customerId: null,
      assigneeId: null,
      blockedReason: null,
      dueAt: null,
    });
  });

  it("requires a blocked reason for blocked tasks", () => {
    const result = updateTaskSchema.safeParse({ ...form, status: "blocked", blockedReason: "  " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["blockedReason"]);
    expect(updateTaskSchema.parse({ ...form, status: "blocked", blockedReason: " Legal " }).blockedReason).toBe("Legal");
  });
});

describe("moveTaskSchema", () => {
  it("accepts an optional blocked reason", () => {
    expect(moveTaskSchema.parse({ taskId: 1, status: "blocked", blockedReason: " Vendor " })).toEqual({ taskId: 1, status: "blocked", blockedReason: "Vendor" });
    expect(moveTaskSchema.parse({ taskId: 1, status: "todo" })).toEqual({ taskId: 1, status: "todo" });
  });
});

describe("logTimeSchema", () => {
  it("parses decimal hours and an optional note", () => {
    expect(logTimeSchema.parse({ taskId: "4", hours: "1.5", note: "  QA " })).toEqual({ taskId: 4, hours: 1.5, note: "QA" });
    expect(logTimeSchema.parse({ taskId: "4", hours: "2" })).toEqual({ taskId: 4, hours: 2, note: null });
  });

  it("rejects malformed hours", () => {
    for (const hours of ["", "abc", "-1", "1e3", "1.234"]) expect(logTimeSchema.safeParse({ taskId: "4", hours }).success).toBe(false);
  });
});
