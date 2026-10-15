"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useState } from "react";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/dialog";
import { Icon } from "@/shared/ui/icon";
import { Menu, MenuItem } from "@/shared/ui/menu";
import { markInvoicePaidAction, sendInvoiceAction, sendInvoiceReminderAction } from "../actions";
import { INITIAL_INVOICE_ACTION_STATE, type InvoiceActionState } from "../form-schema";

export interface InvoiceActionsProps {
  invoiceNumber: string;
  company: string;
  /** Formatted outstanding balance ("$7,440.00"). */
  balance: string;
  /** Unpaid invoice with a balance: reminders and "Mark as paid" are available. */
  unpaid: boolean;
}

function useInvoiceActions({ invoiceNumber }: Pick<InvoiceActionsProps, "invoiceNumber">) {
  const [confirming, setConfirming] = useState(false);
  const [sendState, send, sending] = useActionState(sendInvoiceAction, INITIAL_INVOICE_ACTION_STATE);
  const [remindState, remind, reminding] = useActionState(sendInvoiceReminderAction, INITIAL_INVOICE_ACTION_STATE);
  const [paidState, markPaid, marking] = useActionState(async (prev: InvoiceActionState, data: FormData) => {
    const next = await markInvoicePaidAction(prev, data);
    if (next.status === "success") setConfirming(false);
    return next;
  }, INITIAL_INVOICE_ACTION_STATE);

  const run = (action: (data: FormData) => void) => {
    const data = new FormData();
    data.set("invoiceNumber", invoiceNumber);
    startTransition(() => action(data));
  };
  // The latest outcome wins; the mark-as-paid error is shown inside its dialog.
  const results = [sendState, remindState, confirming ? INITIAL_INVOICE_ACTION_STATE : paidState].filter((s) => s.message);
  return {
    confirming,
    setConfirming,
    send: () => run(send),
    remind: () => run(remind),
    markPaid,
    paidState,
    busy: sending || reminding || marking,
    marking,
    result: results.at(-1) ?? null,
  };
}

function ResultLine({ result }: { result: InvoiceActionState | null }) {
  if (!result?.message) return null;
  return (
    <p role={result.status === "error" ? "alert" : "status"} className={result.status === "error" ? "text-body-sm text-danger-strong" : "text-body-sm text-success"}>
      {result.message}
    </p>
  );
}

function MarkPaidDialog({ props, actions }: { props: InvoiceActionsProps; actions: ReturnType<typeof useInvoiceActions> }) {
  return (
    <ConfirmDialog
      open={actions.confirming}
      onClose={() => actions.setConfirming(false)}
      id={`mark-paid-${props.invoiceNumber}`}
      title={`Mark ${props.invoiceNumber} as paid?`}
      description={`A payment of ${props.balance} (the outstanding balance) will be recorded for ${props.company} and the invoice closed.`}
      confirmLabel="Mark as Paid"
      action={actions.markPaid}
      fields={{ invoiceNumber: props.invoiceNumber }}
      pending={actions.marking}
      error={actions.paidState.status === "error" ? actions.paidState.message : null}
    />
  );
}

/** Detail page toolbar: print, send invoice, send reminder and mark as paid. Hidden when printing. */
export function InvoiceActionBar(props: InvoiceActionsProps) {
  const actions = useInvoiceActions(props);
  return (
    <div className="flex flex-col gap-space-sm print:hidden">
      <div className="flex flex-wrap gap-space-sm">
        <Button variant="secondary" icon="print" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
        <Button icon="send" onClick={actions.send} disabled={actions.busy}>
          Send Invoice
        </Button>
        {props.unpaid ? (
          <>
            <Button variant="secondary" icon="notifications_active" onClick={actions.remind} disabled={actions.busy}>
              Send Reminder
            </Button>
            <Button variant="secondary" icon="check_circle" onClick={() => actions.setConfirming(true)} disabled={actions.busy}>
              Mark as Paid
            </Button>
          </>
        ) : null}
      </div>
      <ResultLine result={actions.result} />
      <MarkPaidDialog props={props} actions={actions} />
    </div>
  );
}

/** Table row "More actions" menu. */
export function InvoiceRowMenu(props: InvoiceActionsProps & { viewHref: string; triggerClassName: string }) {
  const router = useRouter();
  const actions = useInvoiceActions(props);
  return (
    <>
      <Menu triggerLabel={`More actions for invoice ${props.invoiceNumber}`} triggerClassName={props.triggerClassName} trigger={<Icon name="more_vert" size={18} />} align="right">
        {(close) => (
          <>
            <MenuItem icon="visibility" onSelect={() => (close(), router.push(props.viewHref))}>
              View / print
            </MenuItem>
            <MenuItem icon="send" disabled={actions.busy} onSelect={() => (close(), actions.send())}>
              Send invoice
            </MenuItem>
            {props.unpaid ? (
              <>
                <MenuItem icon="notifications_active" disabled={actions.busy} onSelect={() => (close(), actions.remind())}>
                  Send reminder
                </MenuItem>
                <MenuItem icon="payments" onSelect={() => (close(), router.push(`${props.viewHref}#record-payment`))}>
                  Record payment
                </MenuItem>
                <MenuItem icon="check_circle" onSelect={() => (close(), actions.setConfirming(true))}>
                  Mark as paid
                </MenuItem>
              </>
            ) : null}
          </>
        )}
      </Menu>
      <div className="max-w-56 text-left">
        <ResultLine result={actions.result} />
      </div>
      <MarkPaidDialog props={props} actions={actions} />
    </>
  );
}
