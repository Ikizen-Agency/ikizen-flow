import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/shared/ui/icon";
import { Overlay } from "@/shared/ui/overlay";
import type { EffectiveOrderStatus } from "../../domain/order";
import { OrderStatusActions, type StatusActionOption } from "./order-status-actions";
import { OrderStatusBadge } from "./order-status-badge";

export interface OrderDrawerProps {
  closeHref: string;
  reference: string;
  status: EffectiveOrderStatus;
  storedStatusNote: string | null;
  company: string;
  customerHref: string;
  title: string;
  facts: ReadonlyArray<{ label: string; value: string }>;
  items: ReadonlyArray<{ id: number; title: string; description: string | null; quantity: string; rate: string; total: string }>;
  totals: ReadonlyArray<{ label: string; value: string; strong?: boolean }>;
  actions: ReadonlyArray<StatusActionOption>;
  /** Edit / delete controls. */
  manage?: ReactNode;
  /** Balance, payment history and the record payment form. */
  payments?: ReactNode;
}

/** Slide-over order detail with line items, totals and lifecycle actions. */
export function OrderDrawer(props: OrderDrawerProps) {
  return (
    <Overlay closeHref={props.closeHref} variant="drawer" labelledBy="order-drawer-title">
      <div className="flex items-start justify-between bg-surface-container-low p-space-lg">
        <div>
          <div className="flex items-center gap-space-sm">
            <h2 id="order-drawer-title" className="tabular text-headline-md text-ink">
              #{props.reference}
            </h2>
            <OrderStatusBadge status={props.status} />
          </div>
          <p className="mt-1 text-body-md text-ink-muted">{props.title}</p>
          <Link href={props.customerHref} className="text-label-md text-accent hover:underline">
            {props.company}
          </Link>
        </div>
        <Link href={props.closeHref} scroll={false} aria-label="Close" className="rounded-control p-1 text-ink-subtle hover:bg-surface-container">
          <Icon name="close" size={20} />
        </Link>
      </div>

      <div className="flex flex-col gap-space-lg p-space-lg">
        <dl className="grid grid-cols-2 gap-space-sm">
          {props.facts.map((f) => (
            <div key={f.label} className="rounded-control bg-surface-container-low p-space-sm">
              <dt className="text-label-sm text-ink-subtle uppercase">{f.label}</dt>
              <dd className="mt-1 text-label-md text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>

        <section className="flex flex-col gap-space-sm">
          <h3 className="text-label-sm font-semibold tracking-wider text-ink-subtle uppercase">Deliverables</h3>
          <ul className="flex flex-col gap-2">
            {props.items.map((item) => (
              <li key={item.id} className="rounded-control bg-surface-container-low p-3">
                <div className="flex justify-between gap-space-md">
                  <p className="text-label-md text-ink">{item.title}</p>
                  <p className="tabular text-label-md text-ink">{item.total}</p>
                </div>
                {item.description ? <p className="text-body-sm text-ink-subtle">{item.description}</p> : null}
                <p className="tabular mt-1 text-body-sm text-ink-subtle">
                  {item.quantity} × {item.rate}
                </p>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-1 border-t border-line pt-space-sm">
            {props.totals.map((t) => (
              <div key={t.label} className={t.strong ? "flex justify-between text-headline-sm text-ink" : "flex justify-between text-body-md text-ink-muted"}>
                <dt>{t.label}</dt>
                <dd className="tabular">{t.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {props.payments}

        <section className="flex flex-col gap-space-sm">
          <h3 className="text-label-sm font-semibold tracking-wider text-ink-subtle uppercase">Update Status</h3>
          {props.storedStatusNote ? <p className="text-body-sm text-danger-strong">{props.storedStatusNote}</p> : null}
          <OrderStatusActions key={props.status} reference={props.reference} options={props.actions} />
          {props.manage}
        </section>
      </div>
    </Overlay>
  );
}
