"use client";

import { useActionState, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { setBlockedReasonAction } from "../actions";
import type { TaskMutationResult } from "../form-schema";

const IDLE: TaskMutationResult = { ok: true };

/** Drawer banner for blocked tasks: shows the reason and edits it in place. */
export function TaskBlocker({ taskId, reason }: { taskId: number; reason: string | null }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (prev: TaskMutationResult, data: FormData) => {
    const next = await setBlockedReasonAction(prev, data);
    if (next.ok) setEditing(false);
    return next;
  }, IDLE);

  return (
    <section aria-labelledby="task-blocker" className="rounded-card border border-danger-line bg-danger-tint p-space-md">
      <div className="flex items-center justify-between gap-space-sm">
        <h3 id="task-blocker" className="inline-flex items-center gap-1.5 text-label-md text-danger-strong">
          <Icon name="pause_circle" size={16} />
          Blocked
        </h3>
        {editing ? null : (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-label-sm text-danger-strong hover:underline">
            <Icon name="edit" size={14} />
            Edit reason
          </button>
        )}
      </div>
      {editing ? (
        <form action={action} className="mt-space-sm flex flex-wrap items-center gap-space-sm">
          <input type="hidden" name="taskId" value={taskId} />
          <input
            name="reason"
            required
            maxLength={200}
            autoFocus
            defaultValue={reason ?? ""}
            aria-label="Blocked reason"
            className="h-9 min-w-0 flex-1 rounded-control border border-line bg-card px-space-sm text-body-sm text-ink focus:shadow-focus focus:outline-none"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <p className="mt-1 text-body-md text-ink">{reason ?? "No reason recorded."}</p>
      )}
      {!state.ok ? (
        <p role="alert" className="mt-1 text-body-sm text-danger-strong">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
