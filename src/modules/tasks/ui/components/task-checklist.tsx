"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { addSubtaskAction, deleteSubtaskAction, renameSubtaskAction, toggleSubtaskAction } from "../actions";
import type { TaskMutationResult } from "../form-schema";

const IDLE: TaskMutationResult = { ok: true };

export interface ChecklistItem {
  id: number;
  title: string;
  done: boolean;
}

type ChecklistChange = { kind: "toggle"; id: number; done: boolean } | { kind: "remove"; id: number };

const inputClass =
  "h-9 min-w-0 flex-1 rounded-control border border-line bg-card px-space-sm text-body-sm text-ink focus:shadow-focus focus:outline-none";

/** Drawer checklist: optimistic toggle and delete, inline rename and "Add item". */
export function TaskChecklist({ taskId, items }: { taskId: number; items: ReadonlyArray<ChecklistItem> }) {
  const [subtasks, applyChange] = useOptimistic(items, (state, change: ChecklistChange) =>
    change.kind === "toggle" ? state.map((s) => (s.id === change.id ? { ...s, done: change.done } : s)) : state.filter((s) => s.id !== change.id),
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addState, addAction, addPending] = useActionState(addSubtaskAction, IDLE);
  const [renameState, renameAction, renamePending] = useActionState(async (prev: TaskMutationResult, data: FormData) => {
    const next = await renameSubtaskAction(prev, data);
    if (next.ok) setEditingId(null);
    return next;
  }, IDLE);
  const addForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (addState.ok && !addPending) addForm.current?.reset();
  }, [addState, addPending]);

  const run = (change: ChecklistChange, call: (fd: FormData) => Promise<TaskMutationResult>, fields: Record<string, string>) => {
    setError(null);
    startTransition(async () => {
      applyChange(change);
      const fd = new FormData();
      fd.set("taskId", String(taskId));
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const result = await call(fd);
      if (!result.ok) setError(result.message ?? "The checklist could not be updated.");
    });
  };

  const completed = subtasks.filter((s) => s.done).length;

  return (
    <section aria-labelledby="task-checklist">
      <div className="flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-2">
          <h3 id="task-checklist" className="text-headline-sm text-ink">
            Subtasks Checklist
          </h3>
          <span className="tabular rounded-full bg-accent-tint px-2 py-0.5 text-label-sm text-accent">
            {completed}/{subtasks.length}
          </span>
        </div>
        <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding} className="inline-flex items-center gap-1 text-label-md text-accent hover:underline">
          <Icon name="add" size={16} />
          Add item
        </button>
      </div>
      {error || !renameState.ok ? (
        <p role="alert" className="mt-space-sm text-body-sm text-danger-strong">
          {error ?? renameState.message}
        </p>
      ) : null}
      <ul className="mt-space-sm flex flex-col">
        {subtasks.map((s) =>
          editingId === s.id ? (
            <li key={s.id}>
              <form action={renameAction} className="flex items-center gap-space-sm py-1">
                <input type="hidden" name="taskId" value={taskId} />
                <input type="hidden" name="subtaskId" value={s.id} />
                <input name="title" required maxLength={160} defaultValue={s.title} autoFocus aria-label="Checklist item" className={inputClass} />
                <Button type="submit" size="sm" disabled={renamePending}>
                  {renamePending ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </form>
            </li>
          ) : (
            <li key={s.id} className="group flex items-center gap-1 rounded-control hover:bg-surface-container-low">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-space-sm px-1 py-2">
                <input
                  type="checkbox"
                  checked={s.done}
                  onChange={(e) => run({ kind: "toggle", id: s.id, done: e.target.checked }, toggleSubtaskAction, { subtaskId: String(s.id), done: String(e.target.checked) })}
                  className="size-4 accent-accent"
                />
                <span className={cn("text-body-md", s.done ? "text-ink-subtle line-through" : "text-ink")}>{s.title}</span>
              </label>
              <button type="button" onClick={() => setEditingId(s.id)} aria-label={`Rename ${s.title}`} className="rounded-control p-1 text-ink-subtle hover:text-ink">
                <Icon name="edit" size={16} />
              </button>
              <button
                type="button"
                onClick={() => run({ kind: "remove", id: s.id }, deleteSubtaskAction, { subtaskId: String(s.id) })}
                aria-label={`Delete ${s.title}`}
                className="rounded-control p-1 text-ink-subtle hover:text-danger"
              >
                <Icon name="delete" size={16} />
              </button>
            </li>
          ),
        )}
        {subtasks.length === 0 && !adding ? <li className="py-2 text-body-sm text-ink-subtle">No checklist items yet.</li> : null}
      </ul>
      {adding ? (
        <form ref={addForm} action={addAction} className="mt-space-sm flex items-center gap-space-sm">
          <input type="hidden" name="taskId" value={taskId} />
          <input name="title" required maxLength={160} autoFocus aria-label="New checklist item" placeholder="Describe the next step..." className={inputClass} />
          <Button type="submit" size="sm" disabled={addPending}>
            {addPending ? "Adding..." : "Add"}
          </Button>
        </form>
      ) : null}
      {!addState.ok ? <p className="mt-1 text-body-sm text-danger-strong">{addState.message}</p> : null}
    </section>
  );
}
