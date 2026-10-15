"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition, type DragEvent } from "react";
import { cn } from "@/shared/lib/cn";
import { Avatar } from "@/shared/ui/avatar";
import { Icon } from "@/shared/ui/icon";
import { moveTaskInList } from "../../domain/board";
import { TASK_STATUS_LABELS, TASK_STATUSES, type TaskStatus } from "../../domain/task";
import { moveTaskAction } from "../actions";
import { ClientBadge, DueLabel, PriorityBadge, STATUS_DOT, type TaskCardModel } from "./task-badges";

export interface TaskBoardProps {
  tasks: ReadonlyArray<TaskCardModel>;
  /** "+" link per column, opening the create form with that column preselected. */
  createHrefs: Record<TaskStatus, string>;
}

const COUNT_PILL: Record<TaskStatus, string> = {
  todo: "bg-surface-container text-ink-muted",
  in_progress: "bg-surface-container text-ink-muted",
  blocked: "bg-danger-tint text-danger-strong",
  completed: "bg-success-tint text-success-strong",
};

const DRAG_TYPE = "application/x-ikizen-task";

/**
 * Kanban board. Cards move by native HTML5 drag and drop or by the per-card "Move to" select
 * (keyboard and touch friendly). Both paths update the UI optimistically and persist through a Server Action.
 */
export function TaskBoard({ tasks, createHrefs }: TaskBoardProps) {
  const [optimistic, applyMove] = useOptimistic(tasks, (state, move: { id: number; status: TaskStatus }) =>
    moveTaskInList(state, move.id, move.status),
  );
  const [, startTransition] = useTransition();
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);

  const move = (id: number, status: TaskStatus) => {
    const task = optimistic.find((t) => t.id === id);
    if (!task || task.status === status) return;
    setError(null);
    startTransition(async () => {
      applyMove({ id, status });
      const result = await moveTaskAction(id, status);
      if (result.ok) setAnnouncement(`Moved "${task.title}" to ${TASK_STATUS_LABELS[status]}.`);
      else setError(result.message ?? "The task could not be moved.");
    });
  };

  const onDrop = (status: TaskStatus) => (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDropTarget(null);
    const id = Number(e.dataTransfer.getData(DRAG_TYPE));
    if (Number.isInteger(id) && id > 0) move(id, status);
  };

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {error ? (
        <p role="alert" className="rounded-control border border-danger-line bg-danger-tint p-space-sm text-body-sm text-danger-strong">
          {error}
        </p>
      ) : null}
      <div className="-mx-margin-mobile flex snap-x gap-gutter overflow-x-auto px-margin-mobile pb-space-sm md:mx-0 md:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
        {TASK_STATUSES.map((status) => {
          const cards = optimistic.filter((t) => t.status === status);
          return (
            <section
              key={status}
              aria-labelledby={`column-${status}`}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dropTarget !== status) setDropTarget(status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
              }}
              onDrop={onDrop(status)}
              className={cn(
                "flex w-[85vw] max-w-sm shrink-0 snap-start flex-col gap-space-sm rounded-card bg-surface-container-low p-space-sm transition-colors sm:w-80 lg:w-auto lg:max-w-none",
                dropTarget === status && "bg-accent-tint ring-2 ring-accent ring-inset",
              )}
            >
              <header className="flex items-center justify-between px-1 py-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status])} aria-hidden />
                  <h2 id={`column-${status}`} className="text-label-md tracking-[0.04em] text-ink uppercase">
                    {TASK_STATUS_LABELS[status]}
                  </h2>
                  <span className={cn("tabular rounded-full px-2 py-0.5 text-label-sm", COUNT_PILL[status])}>{cards.length}</span>
                </div>
                {status === "completed" ? (
                  <span className="p-1 text-ink-subtle" title="Completed tasks">
                    <Icon name="done_all" size={18} />
                  </span>
                ) : (
                  <Link
                    href={createHrefs[status]}
                    scroll={false}
                    aria-label={`Add task to ${TASK_STATUS_LABELS[status]}`}
                    className="rounded-control p-1 text-ink-subtle transition-colors hover:bg-card hover:text-ink"
                  >
                    <Icon name="add" size={18} />
                  </Link>
                )}
              </header>
              <ol className="flex min-h-24 flex-col gap-space-sm">
                {cards.map((task) => (
                  <li key={task.id}>
                    <TaskCard task={task} onMove={(next) => move(task.id, next)} />
                  </li>
                ))}
                {cards.length === 0 ? (
                  <li className="rounded-card border border-dashed border-line-strong p-space-md text-center text-body-sm text-ink-subtle">
                    Drop tasks here
                  </li>
                ) : null}
              </ol>
            </section>
          );
        })}
      </div>
    </>
  );
}

function TaskCard({ task, onMove }: { task: TaskCardModel; onMove: (status: TaskStatus) => void }) {
  const [dragging, setDragging] = useState(false);
  const done = task.status === "completed";
  const due = done ? task.doneDue : task.openDue;
  const showProgress = !done && task.subtasks.total > 0 && (task.priority === "urgent" || task.status === "in_progress");

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, String(task.id));
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={cn(
        "group relative flex cursor-grab flex-col gap-space-sm rounded-card border border-line bg-card p-space-md shadow-level-1 transition-shadow hover:shadow-level-2 active:cursor-grabbing",
        task.priority === "urgent" && !done && "border-l-2 border-l-danger",
        dragging && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-space-sm">
        <ClientBadge name={task.client} internal={task.internal} className="max-w-[60%]" />
        <PriorityBadge priority={task.priority} done={done} />
      </div>

      {task.status === "blocked" && task.blockedReason ? (
        <p className="flex items-center gap-1.5 rounded-control bg-accent-tint px-2 py-1 text-label-sm text-accent">
          <Icon name="pause_circle" size={14} />
          <span className="truncate">{task.blockedReason}</span>
        </p>
      ) : null}

      <h3 className={cn("text-headline-sm text-ink", done && "text-ink-subtle line-through")}>
        <Link
          href={task.href}
          scroll={false}
          draggable={false}
          className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-accent"
        >
          {task.title}
        </Link>
      </h3>

      {showProgress ? (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-container"
          role="progressbar"
          aria-label="Subtasks completed"
          aria-valuenow={task.subtasks.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${task.subtasks.percent}%` }} />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-space-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-x-space-sm gap-y-1">
          <DueLabel due={due} />
          {task.commentCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-label-sm text-ink-subtle" title={`${task.commentCount} comments`}>
              <Icon name="chat_bubble" size={14} />
              <span className="tabular">{task.commentCount}</span>
            </span>
          ) : null}
          {task.subtasks.total > 0 && !done ? (
            <span className="inline-flex items-center gap-1 text-label-sm text-ink-subtle" title="Subtasks">
              <Icon name="checklist" size={14} />
              <span className="tabular">
                {task.subtasks.done}/{task.subtasks.total}
              </span>
            </span>
          ) : null}
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          <label
            className="relative inline-flex size-7 items-center justify-center rounded-control text-ink-subtle transition-colors focus-within:outline-2 focus-within:outline-accent hover:bg-surface-container-low hover:text-ink"
            title="Move to..."
          >
            <Icon name="swap_horiz" size={16} />
            <span className="sr-only">Move {task.title} to</span>
            <select
              value={task.status}
              onChange={(e) => onMove(e.target.value as TaskStatus)}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          {task.assigneeName ? <Avatar name={task.assigneeName} size="xs" /> : null}
        </div>
      </div>
    </article>
  );
}
