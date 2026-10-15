import { describe, expect, it } from "vitest";
import { parseTaskBoardParams, taskFilterQuery } from "./board-params";

describe("parseTaskBoardParams", () => {
  it("defaults to the unfiltered kanban view", () => {
    expect(parseTaskBoardParams({})).toEqual({ view: "kanban", create: false });
  });

  it("reads filters, view, the open task and the create form", () => {
    expect(
      parseTaskBoardParams({
        view: "list",
        assignee: "3",
        priority: "urgent",
        client: "internal",
        due: "7d",
        task: "12",
        create: "1",
        status: "blocked",
      }),
    ).toEqual({
      view: "list",
      assigneeId: 3,
      priority: "urgent",
      client: "internal",
      due: "7d",
      taskId: 12,
      create: true,
      createStatus: "blocked",
    });
  });

  it("ignores unknown or malformed values", () => {
    expect(
      parseTaskBoardParams({ view: "grid", assignee: "x", priority: "asap", client: "-4", due: "1y", task: "0", status: "done" }),
    ).toEqual({ view: "kanban", create: false });
    expect(parseTaskBoardParams({ client: ["7", "8"] }).client).toBe(7);
  });
});

describe("taskFilterQuery", () => {
  it("serializes only the active filters and the view for links", () => {
    expect(taskFilterQuery(parseTaskBoardParams({ view: "list", assignee: "2", due: "today", task: "5", create: "1" }))).toEqual({
      view: "list",
      assignee: 2,
      priority: undefined,
      client: undefined,
      due: "today",
    });
  });
});
