"use client";

import { useActionState, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { deleteTimeEntryAction, logTimeAction } from "../actions";
import type { TaskMutationResult } from "../form-schema";

const IDLE: TaskMutationResult = { ok: true };

/** Display-ready time entry (formatting happens on the server). */
export interface TimeEntryView {
  id: number;
  member: string;
  duration: string;
  note: string | null;
  when: string;
  /** Logged by the signed-in member (may delete). */
  own: boolean;
}

export interface TaskTimeLogProps {
  taskId: number;
  tracked: string;
  estimate: string | null;
  /** Tracked share of the estimate (0..1+), null without an estimate. */
  ratio: number | null;
  entries: ReadonlyArray<TimeEntryView>;
}

const inputClass = "h-9 rounded-control border border-line bg-card px-space-sm text-body-sm text-ink focus:shadow-focus focus:outline-none";

/** Drawer "Time Tracking": tracked vs estimate, entries (delete your own) and the "Log time" form. */
export function TaskTimeLog({ taskId, tracked, estimate, ratio, entries }: TaskTimeLogProps) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(async (prev: TaskMutationResult, data: FormData) => {
    const next = await logTimeAction(prev, data);
    if (next.ok) {
      setFormKey((k) => k + 1);
      setOpen(false);
    }
    return next;
  }, IDLE);
  const [deletion, deleteAction, deleting] = useActionState(deleteTimeEntryAction, IDLE);

  return (
    <section aria-labelledby="task-time">
      <div className="flex items-center justify-between gap-space-sm">
        <h3 id="task-time" className="text-headline-sm text-ink">
          Time Tracking
        </h3>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1 text-label-md text-accent hover:underline">
          <Icon name="more_time" size={16} />
          Log time
        </button>
      </div>
      <div className="mt-space-sm rounded-card bg-surface-container-low p-space-md">
        <p className="text-body-md text-ink">
          <span className="tabular text-headline-sm">{tracked}</span> tracked{estimate ? <span className="text-ink-subtle"> of {estimate} estimated</span> : null}
        </p>
        {ratio !== null ? (
          <div
            className="mt-space-sm h-1.5 overflow-hidden rounded-full bg-surface-container"
            role="progressbar"
            aria-label="Tracked time against the estimate"
            aria-valuenow={Math.round(ratio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={ratio > 1 ? "h-full rounded-full bg-danger" : "h-full rounded-full bg-accent"} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
          </div>
        ) : null}
      </div>
      {open ? (
        <form key={formKey} action={action} className="mt-space-sm flex flex-wrap items-center gap-space-sm">
          <input type="hidden" name="taskId" value={taskId} />
          <input name="hours" required inputMode="decimal" placeholder="1.5" aria-label="Hours" autoFocus className={`${inputClass} w-20`} />
          <input name="note" maxLength={200} placeholder="What did you work on?" aria-label="Note" className={`${inputClass} min-w-0 flex-1`} />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving..." : "Log"}
          </Button>
        </form>
      ) : null}
      {!state.ok || !deletion.ok ? (
        <p role="alert" className="mt-1 text-body-sm text-danger-strong">
          {state.ok ? deletion.message : state.message}
        </p>
      ) : null}
      {entries.length > 0 ? (
        <ul className="mt-space-sm flex flex-col">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-space-sm border-b border-line-soft py-2 last:border-0">
              <span className="tabular w-16 shrink-0 text-label-md text-ink">{e.duration}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm text-ink-muted">{e.note ?? "No note"}</p>
                <p className="text-label-sm text-ink-subtle">
                  {e.member} · {e.when}
                </p>
              </div>
              {e.own ? (
                <form action={deleteAction}>
                  <input type="hidden" name="entryId" value={e.id} />
                  <button type="submit" disabled={deleting} aria-label={`Delete ${e.duration} entry`} className="rounded-control p-1 text-ink-subtle hover:text-danger">
                    <Icon name="delete" size={16} />
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-space-sm text-body-sm text-ink-subtle">No time logged yet.</p>
      )}
    </section>
  );
}
