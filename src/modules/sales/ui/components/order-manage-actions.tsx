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
  /** Only drafts and cancelled orders can be deleted. */
  deletable: boolean;
}

/** Drawer actions: reopen the order in the composer and delete it (with a destructive confirmation). */
export function OrderManageActions({ reference, editHref, deletable }: OrderManageActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteOrderAction, INITIAL_STATUS_CHANGE_STATE);
  if (!editHref && !deletable) return null;
  return (
    <div className="flex flex-wrap gap-space-sm">
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
        description="The order, its line items and any recorded payments are permanently removed."
        confirmLabel="Delete Order"
        action={action}
        fields={{ reference }}
        pending={pending}
        error={state.status === "error" ? state.message : null}
      />
    </div>
  );
}
