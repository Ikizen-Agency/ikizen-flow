"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { Button, buttonClasses } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/dialog";
import { Icon } from "@/shared/ui/icon";
import { Select } from "@/shared/ui/input";
import { archiveCustomerAction, deleteCustomerAction, updateCustomerLifecycleAction } from "../actions";
import { INITIAL_CUSTOMER_ACTION_STATE, type CustomerActionState } from "../form-schema";

type Option = { value: string; label: string };

export interface CustomerDrawerActionsProps {
  id: number;
  company: string;
  status: string;
  tier: string;
  archived: boolean;
  statusOptions: ReadonlyArray<Option>;
  tierOptions: ReadonlyArray<Option>;
  editHref: string;
  closeHref: string;
}

function Message({ state }: { state: { status: string; message?: string } }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-body-sm text-danger-strong" : "text-body-sm text-success"}>
      {state.message}
    </p>
  );
}

/** Drawer management: status + tier quick edit, edit dialog link, archive/unarchive and delete. */
export function CustomerDrawerActions(props: CustomerDrawerActionsProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [lifecycle, lifecycleAction, saving] = useActionState(updateCustomerLifecycleAction, INITIAL_CUSTOMER_ACTION_STATE);
  const [archive, archiveAction, archiving] = useActionState(archiveCustomerAction, INITIAL_CUSTOMER_ACTION_STATE);
  const [deletion, deleteAction, deleting] = useActionState(async (prev: CustomerActionState, data: FormData) => {
    const next = await deleteCustomerAction(prev, data);
    if (next.status === "success") {
      setConfirming(false);
      router.replace(props.closeHref, { scroll: false });
    }
    return next;
  }, INITIAL_CUSTOMER_ACTION_STATE);

  return (
    <section className="flex flex-col gap-space-sm" aria-labelledby="customer-manage-title">
      <h3 id="customer-manage-title" className="text-label-sm font-semibold tracking-wider text-ink-subtle uppercase">
        Manage Account
      </h3>
      <form action={lifecycleAction} className="flex flex-col gap-space-sm rounded-card bg-surface-container-low p-space-md">
        <input type="hidden" name="id" value={props.id} />
        <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1 text-label-sm text-ink-subtle">
            Status
            <Select key={`s-${props.status}`} name="status" defaultValue={props.status} aria-label="Customer status">
              {props.statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-label-sm text-ink-subtle">
            Tier
            <Select key={`t-${props.tier}`} name="tier" defaultValue={props.tier} aria-label="Customer tier">
              {props.tierOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" variant="secondary" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
        <Message state={lifecycle} />
      </form>
      <div className="flex flex-wrap gap-space-sm">
        <Link href={props.editHref} scroll={false} className={buttonClasses({ variant: "secondary" })}>
          <Icon name="edit" size={18} />
          Edit
        </Link>
        <form action={archiveAction}>
          <input type="hidden" name="id" value={props.id} />
          <input type="hidden" name="archived" value={String(!props.archived)} />
          <Button type="submit" variant="secondary" icon={props.archived ? "unarchive" : "archive"} disabled={archiving}>
            {props.archived ? "Unarchive" : "Archive"}
          </Button>
        </form>
        <Button variant="destructive" icon="delete" onClick={() => setConfirming(true)}>
          Delete
        </Button>
      </div>
      <Message state={archive} />
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        id="drawer-delete-customer"
        title={`Delete ${props.company}?`}
        description="This permanently removes the customer. Customers with orders or tasks cannot be deleted; archive them instead."
        confirmLabel="Delete Customer"
        action={deleteAction}
        fields={{ id: props.id }}
        pending={deleting}
        error={deletion.status === "error" ? deletion.message : null}
      />
    </section>
  );
}
