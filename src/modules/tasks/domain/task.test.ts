import { describe, expect, it } from "vitest";
import {
  applyTaskStatusChange,
  BlockedReasonRequiredError,
  compareTasksForBoard,
  duplicateTaskTitle,
  nextTaskCode,
  normalizeBlockedReason,
  subtaskProgress,
  taskDueState,
} from "./task";

const now = new Date("2026-10-14T12:00:00Z");

describe("taskDueState", () => {
  it("classifies due dates relative to today", () => {
    expect(taskDueState({ status: "todo", dueAt: new Date("2026-10-12T09:00:00Z") }, now)).toBe("overdue");
    expect(taskDueState({ status: "todo", dueAt: new Date("2026-10-14T17:00:00Z") }, now)).toBe("today");
    expect(taskDueState({ status: "todo", dueAt: new Date("2026-10-15T10:00:00Z") }, now)).toBe("tomorrow");
    expect(taskDueState({ status: "todo", dueAt: new Date("2026-10-20T10:00:00Z") }, now)).toBe("upcoming");
    expect(taskDueState({ status: "todo", dueAt: null }, now)).toBe("none");
  });

  it("treats a task due earlier today as overdue", () => {
    expect(taskDueState({ status: "in_progress", dueAt: new Date("2026-10-14T09:00:00Z") }, now)).toBe("overdue");
  });

  it("never reports completed tasks as overdue", () => {
    expect(taskDueState({ status: "completed", dueAt: new Date("2026-10-01T09:00:00Z") }, now)).toBe("done");
  });
});

describe("applyTaskStatusChange", () => {
  const base = { status: "in_progress" as const, completedAt: null, blockedReason: null };

  it("stamps completion time when a task moves to completed", () => {
    expect(applyTaskStatusChange(base, "completed", now)).toEqual({ status: "completed", completedAt: now, blockedReason: null });
  });

  it("clears completion time when a completed task is reopened", () => {
    const done = { status: "completed" as const, completedAt: now, blockedReason: null };
    expect(applyTaskStatusChange(done, "todo", now).completedAt).toBeNull();
  });

  it("keeps a blocked reason only while blocked", () => {
    const blocked = applyTaskStatusChange(base, "blocked", now, "Waiting on client sign-off");
    expect(blocked.blockedReason).toBe("Waiting on client sign-off");
    expect(applyTaskStatusChange({ ...blocked }, "in_progress", now).blockedReason).toBeNull();
  });

  it("requires a reason when a task moves to blocked", () => {
    expect(() => applyTaskStatusChange(base, "blocked", now)).toThrow(BlockedReasonRequiredError);
    expect(() => applyTaskStatusChange(base, "blocked", now, "   ")).toThrow(BlockedReasonRequiredError);
  });

  it("keeps the current reason of an already blocked task unless a new one is given", () => {
    const blocked = { status: "blocked" as const, completedAt: null, blockedReason: "Pending Stripe review" };
    expect(applyTaskStatusChange(blocked, "blocked", now).blockedReason).toBe("Pending Stripe review");
    expect(applyTaskStatusChange(blocked, "blocked", now, " Legal review ").blockedReason).toBe("Legal review");
  });
});

describe("normalizeBlockedReason", () => {
  it("trims, collapses whitespace and caps the length", () => {
    expect(normalizeBlockedReason("  Waiting   on\nclient ")).toBe("Waiting on client");
    expect(normalizeBlockedReason("")).toBeNull();
    expect(normalizeBlockedReason(null)).toBeNull();
    expect(normalizeBlockedReason("x".repeat(500))).toHaveLength(200);
  });
});

describe("duplicateTaskTitle", () => {
  it("marks the copy and keeps it within the title limit", () => {
    expect(duplicateTaskTitle("Launch site")).toBe("Launch site (copy)");
    expect(duplicateTaskTitle("t".repeat(160))).toHaveLength(160);
    expect(duplicateTaskTitle("t".repeat(160)).endsWith(" (copy)")).toBe(true);
  });
});

describe("compareTasksForBoard", () => {
  it("orders by priority first, then by the earliest due date", () => {
    const tasks = [
      { id: 1, priority: "low" as const, dueAt: new Date("2026-10-15T00:00:00Z") },
      { id: 2, priority: "urgent" as const, dueAt: new Date("2026-10-20T00:00:00Z") },
      { id: 3, priority: "high" as const, dueAt: null },
      { id: 4, priority: "high" as const, dueAt: new Date("2026-10-16T00:00:00Z") },
    ];
    expect([...tasks].sort(compareTasksForBoard).map((t) => t.id)).toEqual([2, 4, 3, 1]);
  });
});

describe("subtaskProgress", () => {
  it("reports done/total and a rounded percentage", () => {
    expect(subtaskProgress([{ done: true }, { done: true }, { done: false }])).toEqual({ done: 2, total: 3, percent: 67 });
    expect(subtaskProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe("nextTaskCode", () => {
  it("increments the latest task code", () => {
    expect(nextTaskCode("TASK-842")).toBe("TASK-843");
    expect(nextTaskCode(null)).toBe("TASK-101");
  });
});
