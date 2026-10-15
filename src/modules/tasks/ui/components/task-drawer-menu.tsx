"use client";

import { useActionState, useRef, useState } from "react";
import { ConfirmDialog } from "@/shared/ui/dialog";
import { Icon } from "@/shared/ui/icon";
import { Menu, MenuItem } from "@/shared/ui/menu";
import { deleteTaskAction, duplicateTaskAction } from "../actions";
import type { TaskMutationResult } from "../form-schema";

const IDLE: TaskMutationResult = { ok: true };

export interface TaskDrawerMenuProps {
  taskId: number;
  code: string;
  title: string;
  editHref: string;
}

/** Drawer "More options": edit (URL dialog), duplicate and delete (destructive confirmation). */
export function TaskDrawerMenu({ taskId, code, title, editHref }: TaskDrawerMenuProps) {
  const [confirming, setConfirming] = useState(false);
  const [deletion, deleteAction, deleting] = useActionState(deleteTaskAction, IDLE);
  const [duplication, duplicateAction, duplicating] = useActionState(duplicateTaskAction, IDLE);
  const duplicateForm = useRef<HTMLFormElement>(null);

  return (
    <>
      <Menu
        trigger={<Icon name={duplicating ? "hourglass_empty" : "more_vert"} size={20} />}
        triggerLabel="More options"
        triggerClassName="rounded-control p-1 text-ink-subtle transition-colors hover:bg-surface-container-low hover:text-ink"
        align="right"
      >
        {(close) => (
          <>
            <MenuItem icon="edit" href={editHref} onSelect={close}>
              Edit task
            </MenuItem>
            <MenuItem
              icon="content_copy"
              disabled={duplicating}
              onSelect={() => {
                close();
                duplicateForm.current?.requestSubmit();
              }}
            >
              Duplicate task
            </MenuItem>
            <MenuItem
              icon="delete"
              danger
              onSelect={() => {
                close();
                setConfirming(true);
              }}
            >
              Delete task
            </MenuItem>
          </>
        )}
      </Menu>
      <form ref={duplicateForm} action={duplicateAction} hidden>
        <input type="hidden" name="taskId" value={taskId} />
      </form>
      {!duplication.ok ? (
        <p role="alert" className="max-w-40 text-label-sm text-danger-strong">
          {duplication.message}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        id="delete-task"
        title={`Delete task #${code}?`}
        description={
          <>
            <strong className="text-ink">{title}</strong> and its checklist, comments, time entries and attachments are permanently removed.
          </>
        }
        confirmLabel="Delete Task"
        action={deleteAction}
        fields={{ taskId }}
        pending={deleting}
        error={deletion.ok ? null : deletion.message}
      />
    </>
  );
}
