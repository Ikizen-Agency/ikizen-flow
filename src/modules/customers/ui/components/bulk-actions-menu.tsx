"use client";

import { useActionState, useState } from "react";
import { Button, buttonClasses } from "@/shared/ui/button";
import { ConfirmDialog, Dialog } from "@/shared/ui/dialog";
import { Icon } from "@/shared/ui/icon";
import { Field, Input, Select, Textarea } from "@/shared/ui/input";
import { Menu, MenuItem } from "@/shared/ui/menu";
import { bulkCustomerAction } from "../actions";
import { INITIAL_CUSTOMER_ACTION_STATE, type BulkCustomerOperation, type CustomerActionState } from "../form-schema";
import { useCustomerSelection } from "./customer-selection";

export interface BulkActionsMenuProps {
  tierOptions: ReadonlyArray<{ value: string; label: string }>;
}

const plural = (n: number) => `${n} customer${n === 1 ? "" : "s"}`;

/** Bulk actions on the selected directory rows: campaign email, tier tag, archive and delete. */
export function BulkActionsMenu({ tierOptions }: BulkActionsMenuProps) {
  const { selected, clear } = useCustomerSelection();
  const [operation, setOperation] = useState<BulkCustomerOperation | null>(null);
  const [state, formAction, pending] = useActionState(async (prev: CustomerActionState, data: FormData) => {
    const next = await bulkCustomerAction(prev, data);
    // Close the dialog and reset the selection once a submit succeeded; errors keep it open.
    if (next.status === "success") {
      setOperation(null);
      clear();
    }
    return next;
  }, INITIAL_CUSTOMER_ACTION_STATE);
  const ids = [...selected];
  const count = ids.length;

  const close = () => setOperation(null);
  const hidden = ids.map((id) => <input key={id} type="hidden" name="ids" value={id} />);
  const error = state.status === "error" && operation ? state.message : null;

  return (
    <div className="flex flex-wrap items-center gap-space-sm">
      <Menu
        triggerLabel={count ? `Bulk actions for ${plural(count)}` : "Bulk actions"}
        triggerClassName={buttonClasses({ variant: "secondary" })}
        trigger={
          <>
            <Icon name="checklist" size={18} />
            Bulk Actions{count ? ` (${count})` : ""}
            <Icon name="expand_more" size={16} />
          </>
        }
      >
        {(closeMenu) => (
          <>
            {(
              [
                { op: "campaign", label: "Send Campaign", icon: "mail" },
                { op: "tier", label: "Apply Tier Tag", icon: "label" },
                { op: "archive", label: "Archive Selected", icon: "archive" },
                { op: "delete", label: "Delete Records", icon: "delete", danger: true },
              ] as const
            ).map((a) => (
              <MenuItem
                key={a.op}
                icon={a.icon}
                danger={"danger" in a}
                disabled={count === 0}
                onSelect={() => {
                  closeMenu();
                  setOperation(a.op);
                }}
              >
                {a.label}
              </MenuItem>
            ))}
            {count === 0 ? <p className="border-t border-line-soft px-4 pt-2 pb-1 text-body-sm text-ink-subtle">Select customers in the table first.</p> : null}
          </>
        )}
      </Menu>
      {state.status !== "idle" && !operation ? (
        <p role="status" className={state.status === "error" ? "text-body-sm text-danger-strong" : "text-body-sm text-ink-muted"}>
          {state.message}
        </p>
      ) : null}

      <Dialog open={operation === "campaign"} onClose={close} labelledBy="bulk-campaign-title" className="max-w-lg">
        <form action={formAction} className="flex flex-col gap-space-md p-space-lg">
          <h2 id="bulk-campaign-title" className="text-headline-md text-ink">
            Send Campaign
          </h2>
          <p className="text-body-sm text-ink-muted">One email to the key contact of each of the {plural(count)} selected. Emails are recorded in the workspace outbox.</p>
          <input type="hidden" name="operation" value="campaign" />
          {hidden}
          <Field label="Subject" htmlFor="campaign-subject">
            <Input id="campaign-subject" name="subject" required maxLength={160} autoFocus />
          </Field>
          <Field label="Message" htmlFor="campaign-message">
            <Textarea id="campaign-message" name="message" required maxLength={5000} rows={6} />
          </Field>
          {error ? (
            <p role="alert" className="text-body-sm text-danger-strong">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-space-sm">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" icon="send" disabled={pending}>
              {pending ? "Sending..." : `Send to ${plural(count)}`}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={operation === "tier"} onClose={close} labelledBy="bulk-tier-title">
        <form action={formAction} className="flex flex-col gap-space-md p-space-lg">
          <h2 id="bulk-tier-title" className="text-headline-md text-ink">
            Apply Tier Tag
          </h2>
          <input type="hidden" name="operation" value="tier" />
          {hidden}
          <Field label={`New tier for ${plural(count)}`} htmlFor="bulk-tier">
            <Select id="bulk-tier" name="tier" defaultValue={tierOptions[0]?.value}>
              {tierOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          {error ? (
            <p role="alert" className="text-body-sm text-danger-strong">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-space-sm">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" icon="label" disabled={pending}>
              {pending ? "Applying..." : "Apply Tier"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={operation === "archive"}
        onClose={close}
        id="bulk-archive"
        title={`Archive ${plural(count)}?`}
        description="Archived customers are hidden from the directory and new sales. You can restore them from the Archived filter."
        confirmLabel="Archive Selected"
        action={formAction}
        fields={{ operation: "archive", ids }}
        pending={pending}
        error={error}
      />
      <ConfirmDialog
        open={operation === "delete"}
        onClose={close}
        id="bulk-delete"
        title={`Delete ${plural(count)}?`}
        description="This permanently removes customers without orders or tasks. Customers with history are skipped and listed so you can archive them instead."
        confirmLabel="Delete Records"
        action={formAction}
        fields={{ operation: "delete", ids }}
        pending={pending}
        error={error}
      />
    </div>
  );
}
