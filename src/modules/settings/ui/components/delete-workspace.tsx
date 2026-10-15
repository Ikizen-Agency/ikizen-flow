"use client";

import { useActionState, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { Icon } from "@/shared/ui/icon";
import { Field, Input } from "@/shared/ui/input";
import { deleteWorkspaceAction } from "../actions";
import { IDLE } from "../form-schema";
import { ActionFeedback } from "./action-feedback";

/** Danger zone: deleting the workspace needs the exact name typed (the server checks it again). */
export function DeleteWorkspace({ workspaceName, canDelete, blockedReason }: { workspaceName: string; canDelete: boolean; blockedReason: string | null }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, dispatch, pending] = useActionState(deleteWorkspaceAction, IDLE);
  const close = () => (setOpen(false), setTyped(""));

  return (
    <div className="flex flex-col gap-space-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-label-md text-ink">Delete this workspace</p>
        <p className="text-body-sm text-ink-subtle">
          {blockedReason ?? "Permanently deletes customers, orders, invoices, tasks, files, activity and the outbox. This cannot be undone."}
        </p>
      </div>
      {canDelete ? (
        <Button variant="destructive" icon="delete_forever" onClick={() => setOpen(true)}>
          Delete workspace
        </Button>
      ) : null}
      <Dialog open={open} onClose={close} labelledBy="delete-workspace-title">
        <form action={dispatch} className="flex flex-col gap-space-md p-space-lg">
          <div className="flex items-start gap-space-md">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-danger-line bg-danger-tint text-danger">
              <Icon name="warning" size={20} />
            </span>
            <div className="flex flex-col gap-1">
              <h2 id="delete-workspace-title" className="text-headline-sm text-ink">
                Delete {workspaceName}?
              </h2>
              <p className="text-body-md text-ink-muted">All data of this workspace is deleted for every member. You will switch to your next workspace.</p>
            </div>
          </div>
          <Field label={`Type "${workspaceName}" to confirm`} htmlFor="delete-confirm">
            <Input id="delete-confirm" name="confirmName" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </Field>
          <ActionFeedback state={state} />
          <div className="flex justify-end gap-space-sm">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive-solid" disabled={pending || typed.trim() !== workspaceName}>
              {pending ? "Deleting..." : "Delete permanently"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
