"use client";

import { useActionState } from "react";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { Field, Select } from "@/shared/ui/input";
import { issueInvoiceAction } from "../actions";
import { INITIAL_INVOICE_ACTION_STATE } from "../form-schema";

export interface IssueInvoiceCardProps {
  /** Pending / processing orders, display-ready. */
  orders: ReadonlyArray<{ reference: string; label: string }>;
}

/** Issues an invoice for a pending or processing order (the sales lifecycle assigns the invoice number). */
export function IssueInvoiceCard({ orders }: IssueInvoiceCardProps) {
  const [state, formAction, pending] = useActionState(issueInvoiceAction, INITIAL_INVOICE_ACTION_STATE);
  return (
    <Card className="flex flex-col gap-space-md" aria-labelledby="issue-invoice-title">
      <CardHeader title={<span id="issue-invoice-title">Issue an Invoice</span>} description="Invoice a pending or in-progress order" />
      {orders.length === 0 ? (
        <p className="rounded-control bg-surface-container-low p-3 text-body-sm text-ink-subtle">Every confirmed order has been invoiced.</p>
      ) : (
        <form action={formAction} className="flex flex-col gap-space-sm">
          <Field label="Order" htmlFor="issue-invoice-order">
            <Select id="issue-invoice-order" name="reference" defaultValue={orders[0]?.reference}>
              {orders.map((o) => (
                <option key={o.reference} value={o.reference}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          {state.message ? (
            <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-body-sm text-danger-strong" : "text-body-sm text-success"}>
              {state.message}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" icon="receipt_long" disabled={pending}>
              {pending ? "Issuing..." : "Issue Invoice"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
