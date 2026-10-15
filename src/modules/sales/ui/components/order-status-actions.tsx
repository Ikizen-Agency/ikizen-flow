"use client";

import { useActionState } from "react";
import { Button } from "@/shared/ui/button";
import type { OrderStatus } from "../../domain/order";
import { changeOrderStatusAction } from "../actions";
import { INITIAL_STATUS_CHANGE_STATE } from "../form-schema";

export interface StatusActionOption {
  status: OrderStatus;
  label: string;
  icon: string;
}

/** Allowed next statuses for an order, each submitting the change-status Server Action. */
export function OrderStatusActions({ reference, options }: { reference: string; options: ReadonlyArray<StatusActionOption> }) {
  const [state, formAction, pending] = useActionState(changeOrderStatusAction, INITIAL_STATUS_CHANGE_STATE);
  if (options.length === 0) return <p className="text-body-sm text-ink-subtle">This order is closed; no further status changes are possible.</p>;
  return (
    <form action={formAction} className="flex flex-col gap-space-sm">
      <input type="hidden" name="reference" value={reference} />
      <div className="flex flex-wrap gap-space-sm">
        {options.map((o) => (
          <Button
            key={o.status}
            type="submit"
            name="status"
            value={o.status}
            icon={o.icon}
            disabled={pending}
            variant={o.status === "cancelled" ? "destructive" : o.status === options[0]?.status ? "primary" : "secondary"}
          >
            {o.label}
          </Button>
        ))}
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-body-sm text-danger-strong">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
