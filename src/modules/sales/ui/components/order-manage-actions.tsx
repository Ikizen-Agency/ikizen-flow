"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, buttonClasses } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/dialog";
import { Icon } from "@/shared/ui/icon";
import { deleteOrderAction } from "../actions";
import { INITIAL_STATUS_CHANGE_STATE } from "../form-schema";

export interface OrderManageActionsProps {
  reference: string;
  /** Composer link for editable (draft / pending) orders. */
  editHref: string | null;
  /** Only unpaid drafts and cancelled orders can be deleted. */
  deletable: boolean;
  /** Why an otherwise editable / deletable order is locked (it has recorded payments). */
  lockedNotes?: ReadonlyArray<string>;
}

/** Drawer actions: reopen the order in the composer and delete it (with a destructive confirmation). */
export function OrderManageActions({ reference, editHref, deletable, lockedNotes = [] }: OrderManageActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteOrderAction, INITIAL_STATUS_CHANGE_STATE);
  if (!editHref && !deletable && lockedNotes.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-space-sm">
      {lockedNotes.length > 0 ? (
        <p className="flex w-full items-start gap-space-xs text-body-sm text-on-surface-variant">
          <Icon name="lock" size={18} />
          <span>{lockedNotes.join(" ")}</span>
        </p>
      ) : null}
      {editHref ? (
        <Link href={editHref} className={buttonClasses({ variant: "secondary" })}>
          <Icon name="edit" size={18} />
          Edit Order
        </Link>
      ) : null}
      {deletable ? (
        <Button variant="destructive" icon="delete" onClick={() => setConfirming(true)}>
          Delete Order
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        id="delete-order"
        title={`Delete order #${reference}?`}
        description="The order and its line items are permanently removed."
        confirmLabel="Delete Order"
        action={action}
        fields={{ reference }}
        pending={pending}
        error={state.status === "error" ? state.message : null}
      />
    </div>
  );
}
