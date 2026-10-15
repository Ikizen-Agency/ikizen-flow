"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useState } from "react";
import { ConfirmDialog } from "@/shared/ui/dialog";
import { Icon } from "@/shared/ui/icon";
import { Menu, MenuItem } from "@/shared/ui/menu";
import { archiveCustomerAction, deleteCustomerAction } from "../actions";
import { INITIAL_CUSTOMER_ACTION_STATE, type CustomerActionState } from "../form-schema";

export interface CustomerRowMenuProps {
  id: number;
  company: string;
  contactEmail: string;
  archived: boolean;
  viewHref: string;
  editHref: string;
  triggerClassName: string;
}

/** Row "More actions" menu: view, edit, email contact, archive/unarchive and delete (with confirmation). */
export function CustomerRowMenu({ id, company, contactEmail, archived, viewHref, editHref, triggerClassName }: CustomerRowMenuProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [archiveState, archiveAction] = useActionState(archiveCustomerAction, INITIAL_CUSTOMER_ACTION_STATE);
  const [deleteState, deleteAction, deleting] = useActionState(async (prev: CustomerActionState, data: FormData) => {
    const next = await deleteCustomerAction(prev, data);
    if (next.status === "success") setConfirming(false);
    return next;
  }, INITIAL_CUSTOMER_ACTION_STATE);

  const toggleArchive = () => {
    const data = new FormData();
    data.set("id", String(id));
    data.set("archived", String(!archived));
    startTransition(() => archiveAction(data));
  };

  return (
    <>
      <Menu triggerLabel={`More actions for ${company}`} triggerClassName={triggerClassName} trigger={<Icon name="more_vert" size={18} />} align="right">
        {(close) => (
          <>
            <MenuItem icon="visibility" onSelect={() => (close(), router.push(viewHref, { scroll: false }))}>
              View
            </MenuItem>
            <MenuItem icon="edit" onSelect={() => (close(), router.push(editHref, { scroll: false }))}>
              Edit
            </MenuItem>
            <MenuItem icon="outgoing_mail" href={`mailto:${contactEmail}`} onSelect={close}>
              Email contact
            </MenuItem>
            <MenuItem icon={archived ? "unarchive" : "archive"} onSelect={() => (close(), toggleArchive())}>
              {archived ? "Unarchive" : "Archive"}
            </MenuItem>
            <MenuItem icon="delete" danger onSelect={() => (close(), setConfirming(true))}>
              Delete
            </MenuItem>
          </>
        )}
      </Menu>
      {archiveState.status === "error" ? (
        <span role="alert" className="block text-body-sm text-danger-strong">
          {archiveState.message}
        </span>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        id={`delete-customer-${id}`}
        title={`Delete ${company}?`}
        description="This permanently removes the customer. Customers with orders or tasks cannot be deleted; archive them instead."
        confirmLabel="Delete Customer"
        action={deleteAction}
        fields={{ id }}
        pending={deleting}
        error={deleteState.status === "error" ? deleteState.message : null}
      />
    </>
  );
}
