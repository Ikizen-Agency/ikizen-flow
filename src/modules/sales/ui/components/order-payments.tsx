"use client";

import { useActionState, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/dialog";
import { Field, Input, Select } from "@/shared/ui/input";
import { deletePaymentAction, recordPaymentAction } from "../actions";
import { INITIAL_PAYMENT_FORM_STATE, INITIAL_STATUS_CHANGE_STATE, type PaymentFormState, type StatusChangeState } from "../form-schema";

/** Display-ready payment row (formatting happens on the server). */
export interface PaymentRow {
  id: number;
  amount: string;
  method: string;
  date: string;
  reference: string | null;
  note: string | null;
  recordedBy: string | null;
}

export interface OrderPaymentsProps {
  reference: string;
  total: string;
  paid: string;
  balance: string;
  /** Share of the total already paid, 0..1. */
  paidRatio: number;
  payments: ReadonlyArray<PaymentRow>;
  /** Record form shown only on payable (open) orders with a balance. */
  canRecord: boolean;
  /** Prefilled amount: the outstanding balance in dollars ("1250.00"). */
  balanceInput: string;
  todayInput: string;
  methodOptions: ReadonlyArray<{ value: string; label: string }>;
}

/** Drawer section: balance summary, payment history (with delete) and the record payment form. */
export function OrderPayments(props: OrderPaymentsProps) {
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(async (prev: PaymentFormState, data: FormData) => {
    const next = await recordPaymentAction(prev, data);
    if (next.status === "success") setFormKey((k) => k + 1);
    return next;
  }, INITIAL_PAYMENT_FORM_STATE);
  const [removing, setRemoving] = useState<PaymentRow | null>(null);
  const [deletion, deleteAction, deleting] = useActionState(async (prev: StatusChangeState, data: FormData) => {
    const next = await deletePaymentAction(prev, data);
    if (next.status !== "error") setRemoving(null);
    return next;
  }, INITIAL_STATUS_CHANGE_STATE);
  const err = (field: keyof NonNullable<PaymentFormState["fieldErrors"]>) => state.fieldErrors?.[field]?.[0];

  return (
    <section className="flex flex-col gap-space-sm" aria-labelledby="order-payments-title">
      <h3 id="order-payments-title" className="text-label-sm font-semibold tracking-wider text-ink-subtle uppercase">
        Payments
      </h3>
      <div className="rounded-card bg-surface-container-low p-space-md">
        <dl className="grid grid-cols-3 gap-space-sm">
          {[
            { label: "Total", value: props.total, cls: "text-ink" },
            { label: "Paid", value: props.paid, cls: "text-success" },
            { label: "Balance", value: props.balance, cls: props.paidRatio >= 1 ? "text-success" : "text-ink" },
          ].map((m) => (
            <div key={m.label}>
              <dt className="text-label-sm text-ink-subtle uppercase">{m.label}</dt>
              <dd className={cn("tabular mt-1 text-headline-sm", m.cls)}>{m.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-space-sm h-1.5 overflow-hidden rounded-full bg-well" role="progressbar" aria-label="Paid share" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(props.paidRatio * 100)}>
          <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, props.paidRatio * 100)}%` }} />
        </div>
      </div>

      {props.payments.length === 0 ? (
        <p className="rounded-control bg-surface-container-low p-3 text-body-sm text-ink-subtle">No payments recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {props.payments.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-space-sm rounded-control bg-surface-container-low p-3">
              <div className="min-w-0">
                <p className="tabular text-label-md text-ink">
                  {p.amount} <span className="text-body-sm text-ink-subtle">· {p.method}</span>
                </p>
                <p className="text-body-sm text-ink-subtle">
                  {p.date}
                  {p.reference ? ` · Ref ${p.reference}` : ""}
                  {p.recordedBy ? ` · by ${p.recordedBy}` : ""}
                </p>
                {p.note ? <p className="text-body-sm text-ink-muted">{p.note}</p> : null}
              </div>
              <Button size="sm" variant="ghost" icon="delete" aria-label={`Delete payment of ${p.amount} on ${p.date}`} onClick={() => setRemoving(p)} />
            </li>
          ))}
        </ul>
      )}
      {deletion.status === "error" && !removing ? (
        <p role="alert" className="text-body-sm text-danger-strong">
          {deletion.message}
        </p>
      ) : null}

      {props.canRecord ? (
        <form key={formKey} action={formAction} noValidate className="flex flex-col gap-space-sm rounded-card border border-line p-space-md">
          <h4 className="text-label-md font-semibold text-ink">Record Payment</h4>
          <input type="hidden" name="reference" value={props.reference} />
          <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
            <Field label="Amount ($)" htmlFor="payment-amount" error={err("amount")} hint={`Up to ${props.balance}`}>
              <Input id="payment-amount" name="amount" inputMode="decimal" defaultValue={props.balanceInput} aria-invalid={err("amount") ? true : undefined} />
            </Field>
            <Field label="Method" htmlFor="payment-method" error={err("method")}>
              <Select id="payment-method" name="method" defaultValue={props.methodOptions[0]?.value}>
                {props.methodOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Paid on" htmlFor="payment-date" error={err("paidOn")}>
              <Input id="payment-date" name="paidOn" type="date" defaultValue={props.todayInput} max={props.todayInput} />
            </Field>
            <Field label="Reference" htmlFor="payment-reference" error={err("paymentReference")} hint="Optional (wire id, receipt...)">
              <Input id="payment-reference" name="paymentReference" maxLength={80} />
            </Field>
          </div>
          <Field label="Note" htmlFor="payment-note" error={err("note")}>
            <Input id="payment-note" name="note" maxLength={500} />
          </Field>
          {state.message ? (
            <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-body-sm text-danger-strong" : "text-body-sm text-success"}>
              {state.message}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" icon="payments" disabled={pending}>
              {pending ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        id="delete-payment"
        title="Delete this payment?"
        description={removing ? `The ${removing.amount} payment from ${removing.date} will be removed and the balance recalculated. A completed order that is no longer fully paid returns to Invoiced.` : null}
        confirmLabel="Delete Payment"
        action={deleteAction}
        fields={{ paymentId: removing?.id ?? 0 }}
        pending={deleting}
        error={deletion.status === "error" ? deletion.message : null}
      />
    </section>
  );
}
