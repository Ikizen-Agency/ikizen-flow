import { describe, expect, it } from "vitest";
import { describeTaskDue, dueWindow, moveTaskInList, operationalKpis, summarizeBoard } from "./board";

const now = new Date("2026-10-14T12:00:00Z");
const at = (iso: string) => new Date(iso);

describe("describeTaskDue", () => {
  const due = (dueAt: Date | null, status: "todo" | "completed" = "todo", completedAt: Date | null = null) =>
    describeTaskDue({ status, dueAt, completedAt }, now, "UTC");

  it("shows the time for tasks due today", () => {
    expect(due(at("2026-10-14T17:00:00Z"))).toEqual({ label: "Today, 5:00 PM", icon: "alarm", tone: "danger" });
  });

  it("flags tomorrow and upcoming dates", () => {
    expect(due(at("2026-10-15T10:00:00Z"))).toEqual({ label: "Tomorrow", icon: "schedule", tone: "warning" });
    expect(due(at("2026-10-28T10:00:00Z"))).toEqual({ label: "Oct 28", icon: "event", tone: "neutral" });
  });

  it("counts whole days overdue", () => {
    expect(due(at("2026-10-12T17:00:00Z"))).toEqual({ label: "2 days overdue", icon: "warning", tone: "danger" });
    expect(due(at("2026-10-13T17:00:00Z"))?.label).toBe("1 day overdue");
    expect(due(at("2026-10-14T09:00:00Z"))?.label).toBe("Overdue, 9:00 AM");
  });

  it("describes completion instead of the due date for completed tasks", () => {
    expect(due(at("2026-10-01T10:00:00Z"), "completed", at("2026-10-13T09:00:00Z"))).toEqual({
      label: "Completed yesterday",
      icon: "event_available",
      tone: "success",
    });
    expect(due(null, "completed", at("2026-10-14T08:00:00Z"))?.label).toBe("Completed today");
    expect(due(null, "completed", at("2026-10-06T08:00:00Z"))?.label).toBe("Completed Oct 6");
    expect(due(null, "completed", null)?.label).toBe("Completed");
  });

  it("returns null when an open task has no due date", () => {
    expect(due(null)).toBeNull();
  });
});

const task = (over: Partial<Parameters<typeof operationalKpis>[0][number]> = {}) => ({
  title: "Task",
  status: "todo" as const,
  priority: "medium" as const,
  dueAt: null,
  completedAt: null,
  updatedAt: at("2026-10-13T12:00:00Z"),
  ...over,
});

describe("summarizeBoard", () => {
  it("counts active tasks, tasks needing attention and critical blockers", () => {
    const summary = summarizeBoard(
      [
        task({ status: "todo", dueAt: at("2026-10-12T10:00:00Z") }), // overdue
        task({ status: "in_progress", dueAt: at("2026-10-14T17:00:00Z") }), // today
        task({ status: "blocked", priority: "urgent", dueAt: at("2026-10-30T10:00:00Z") }), // blocked + critical
        task({ status: "blocked", priority: "low" }), // blocked only
        task({ status: "todo", dueAt: at("2026-10-28T10:00:00Z") }), // fine
        task({ status: "completed", dueAt: at("2026-10-01T10:00:00Z"), completedAt: at("2026-10-02T10:00:00Z") }),
      ],
      now,
    );
    expect(summary).toEqual({ total: 6, active: 5, attention: 4, criticalBlockers: 1 });
  });
});

describe("operationalKpis", () => {
  it("derives completion, velocity, blocked hours and the next milestone", () => {
    const kpis = operationalKpis(
      [
        task({ status: "completed", completedAt: at("2026-10-10T12:00:00Z") }),
        task({ status: "completed", completedAt: at("2026-09-30T12:00:00Z") }),
        task({ status: "completed", completedAt: at("2026-08-01T12:00:00Z") }), // outside the 4-week window
        task({ status: "blocked", updatedAt: at("2026-10-13T12:00:00Z") }), // 24h
        task({ status: "blocked", updatedAt: at("2026-10-14T02:30:00Z") }), // 9.5h -> 9
        task({ title: "Beta Release", priority: "high", dueAt: at("2026-10-20T10:00:00Z") }),
        task({ title: "Later launch", priority: "urgent", dueAt: at("2026-11-20T10:00:00Z") }),
        task({ title: "Low priority", priority: "low", dueAt: at("2026-10-15T10:00:00Z") }),
      ],
      now,
    );
    expect(kpis.completionRate).toBeCloseTo(3 / 8);
    expect(kpis.velocityPerWeek).toBe(0.5);
    expect(kpis.blockedHours).toBe(33);
    expect(kpis.nextMilestone).toEqual({ title: "Beta Release", dueAt: at("2026-10-20T10:00:00Z") });
  });

  it("falls back to any upcoming task and handles an empty board", () => {
    expect(operationalKpis([task({ title: "Only", dueAt: at("2026-10-16T10:00:00Z") })], now).nextMilestone?.title).toBe("Only");
    expect(operationalKpis([], now)).toEqual({ completionRate: 0, velocityPerWeek: 0, blockedHours: 0, nextMilestone: null });
  });
});

describe("dueWindow", () => {
  it("maps quick picks to storage filters over open tasks", () => {
    expect(dueWindow("overdue", now)).toEqual({ dueBefore: now, openOnly: true });
    expect(dueWindow("today", now)).toEqual({ dueBefore: new Date("2026-10-14T23:59:59.999Z"), openOnly: true });
    expect(dueWindow("7d", now)).toEqual({ dueBefore: new Date("2026-10-21T23:59:59.999Z"), openOnly: true });
    expect(dueWindow("30d", now)).toEqual({ dueBefore: new Date("2026-11-13T23:59:59.999Z"), openOnly: true });
    expect(dueWindow(undefined, now)).toEqual({});
  });
});

describe("moveTaskInList", () => {
  it("moves one task to another column without touching the rest", () => {
    const list = [
      { id: 1, status: "todo" as const },
      { id: 2, status: "todo" as const },
    ];
    const moved = moveTaskInList(list, 2, "completed");
    expect(moved).toEqual([
      { id: 1, status: "todo" },
      { id: 2, status: "completed" },
    ]);
    expect(moved[0]).toBe(list[0]);
    expect(list[1]?.status).toBe("todo");
  });
});
