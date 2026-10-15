"use client";

import { useActionState, useState } from "react";
import { ConfirmDialog } from "@/shared/ui/dialog";
import { Icon } from "@/shared/ui/icon";
import { Select } from "@/shared/ui/input";
import { WORKSPACE_ROLE_LABELS, type WorkspaceRole } from "../../../workspaces/domain/workspace";
import { changeRoleAction, removeMemberAction } from "../actions";
import { IDLE } from "../form-schema";

/** Access level picker; submits as soon as the value changes (the server enforces who may change what). */
export function RoleSelect({ memberId, role, options, name }: { memberId: number; role: WorkspaceRole; options: WorkspaceRole[]; name: string }) {
  const [state, dispatch, pending] = useActionState(changeRoleAction, IDLE);
  const choices = options.includes(role) ? options : [role, ...options];
  return (
    <form action={dispatch} className="flex flex-col gap-1">
      <input type="hidden" name="memberId" value={memberId} />
      <Select
        name="role"
        defaultValue={role}
        aria-label={`Access level of ${name}`}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-8 w-32 py-1 text-body-sm"
      >
        {choices.map((r) => (
          <option key={r} value={r}>
            {WORKSPACE_ROLE_LABELS[r]}
          </option>
        ))}
      </Select>
      {state.status === "error" ? (
        <span role="alert" className="max-w-48 text-body-sm text-danger-strong">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

/** "Remove" with a destructive confirmation; open tasks of the member become unassigned. */
export function RemoveMemberButton({ memberId, name }: { memberId: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, dispatch, pending] = useActionState(removeMemberAction, IDLE);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Remove ${name}`}
        title={`Remove ${name}`}
        className="rounded-control p-1.5 text-ink-subtle transition-colors hover:bg-danger-tint hover:text-danger"
      >
        <Icon name="person_remove" size={18} />
      </button>
      <ConfirmDialog
        open={open && state.status !== "success"}
        onClose={() => setOpen(false)}
        id={`remove-member-${memberId}`}
        title={`Remove ${name}?`}
        description="They lose access to this workspace and their open tasks become unassigned. Activity, comments and completed work keep their name."
        confirmLabel="Remove member"
        action={dispatch}
        fields={{ memberId }}
        pending={pending}
        error={state.status === "error" ? state.message : null}
      />
    </>
  );
}
