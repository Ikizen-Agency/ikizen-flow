"use client";

import { useActionState } from "react";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
import { sendReminderAction, type ReminderState } from "../actions";

export interface OverdueItem {
  reference: string;
  daysOverdue: number;
  company: string;
  detail: string;
  amount: string;
  contact: string | null;
}

const IDLE: ReminderState = { status: "idle" };

function ReminderCard({ item }: { item: OverdueItem }) {
  const [state, action, pending] = useActionState(sendReminderAction, IDLE);
  const sent = state.status === "sent";
  return (
    <article className="flex flex-col justify-between gap-space-md rounded-card bg-surface-container-low p-space-md">
      <div className="flex items-start justify-between gap-space-sm">
        <div className="min-w-0">
          <p className="text-label-sm text-danger-strong">
            {item.daysOverdue} Day{item.daysOverdue === 1 ? "" : "s"} Overdue
          </p>
          <h4 className="text-label-md text-ink">{item.company}</h4>
          <p className="text-body-sm text-ink-subtle">{item.detail}</p>
        </div>
        <p className="tabular shrink-0 text-headline-sm text-ink">{item.amount}</p>
      </div>
      <form action={action} className="flex items-center justify-between gap-space-sm border-t border-line pt-space-sm">
        <input type="hidden" name="reference" value={item.reference} />
        <p className="min-w-0 truncate text-body-sm text-ink-subtle" title={item.contact ?? undefined}>
          Contact: {item.contact ?? "—"}
        </p>
        <Button type="submit" size="sm" icon={sent ? "check" : "send"} variant={sent ? "secondary" : "primary"} disabled={pending || sent}>
          {pending ? "Sending..." : sent ? "Reminder Sent" : "Send Reminder"}
        </Button>
      </form>
      <p
        aria-live="polite"
        className={state.message ? (state.status === "error" ? "text-body-sm text-danger-strong" : "text-body-sm text-success-strong") : "sr-only"}
      >
        {state.message}
      </p>
    </article>
  );
}

export function OverdueReceivables({ items, total }: { items: ReadonlyArray<OverdueItem>; total: number }) {
  return (
    <Card className="flex flex-col gap-space-md" aria-labelledby="overdue-title">
      <div className="flex items-start justify-between gap-space-md">
        <div className="flex items-start gap-space-sm">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-danger-tint text-danger">
            <Icon name="notification_important" size={20} />
          </span>
          <div>
            <h3 id="overdue-title" className="text-headline-sm text-ink">
              Overdue Receivables &amp; Collections
            </h3>
            <p className="text-body-sm text-ink-subtle">Immediate follow-up suggested to maintain steady working capital</p>
          </div>
        </div>
        <span className="tabular shrink-0 rounded-badge border border-danger-line bg-danger-tint px-2 py-0.5 text-label-sm text-danger-strong">
          {total} Flag{total === 1 ? "" : "s"}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-card bg-surface-container-low p-space-md text-body-sm text-ink-subtle">No overdue receivables. Collections are on track.</p>
      ) : (
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
          {items.map((item) => (
            <ReminderCard key={item.reference} item={item} />
          ))}
        </div>
      )}
    </Card>
  );
}
