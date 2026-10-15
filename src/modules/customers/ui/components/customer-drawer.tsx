import Link from "next/link";
import { cn } from "@/shared/lib/cn";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { buttonClasses } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Overlay } from "@/shared/ui/overlay";
import { CUSTOMER_STATUS_LABELS, customerStatusTone, type CustomerStatus, type CustomerTier } from "../../domain/customer";
import { CompanyTile, TierTag } from "./customer-badges";

export interface InteractionItem {
  id: number;
  icon: string;
  tone: BadgeTone;
  title: string;
  detail: string;
  when: string;
}

export interface CustomerDrawerProps {
  closeHref: string;
  ordersHref: string;
  company: string;
  tier: CustomerTier;
  status: CustomerStatus;
  lifetimeValue: string;
  openDeals: number;
  healthScore: number;
  contactName: string;
  contactEmail: string;
  details: ReadonlyArray<{ icon: string; label: string; value: string }>;
  interactions: ReadonlyArray<InteractionItem>;
}

const iconTone: Record<BadgeTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-ink-subtle",
  info: "text-accent",
};

function SectionLabel({ children }: { children: string }) {
  return <h3 className="text-label-sm font-semibold tracking-wider text-ink-subtle uppercase">{children}</h3>;
}

/** Slide-over quick inspection panel for one customer. */
export function CustomerDrawer(props: CustomerDrawerProps) {
  const healthTone = props.healthScore >= 80 ? "text-success" : props.healthScore >= 50 ? "text-warning" : "text-danger";
  return (
    <Overlay closeHref={props.closeHref} variant="drawer" labelledBy="customer-drawer-title" className="justify-between">
      <div>
        <div className="flex items-start justify-between bg-surface-container-low p-space-lg">
          <div className="flex items-center gap-space-sm">
            <CompanyTile company={props.company} tier={props.tier} status={props.status} size="lg" />
            <div>
              <h2 id="customer-drawer-title" className="text-headline-md text-ink">
                {props.company}
              </h2>
              <div className="mt-1 flex items-center gap-2">
                <TierTag tier={props.tier} suffix=" Tier" />
                <Badge tone={customerStatusTone(props.status)}>{CUSTOMER_STATUS_LABELS[props.status]}</Badge>
              </div>
            </div>
          </div>
          <Link href={props.closeHref} scroll={false} aria-label="Close" className="rounded-control p-1 text-ink-subtle hover:bg-surface-container">
            <Icon name="close" size={20} />
          </Link>
        </div>

        <div className="flex flex-col gap-space-lg p-space-lg">
          <dl className="grid grid-cols-3 gap-space-sm">
            {[
              { label: "Lifetime Value", value: props.lifetimeValue, cls: "text-ink tabular" },
              { label: "Open Deals", value: `${props.openDeals} Active`, cls: "text-ink" },
              { label: "Health Score", value: `${props.healthScore} / 100`, cls: healthTone },
            ].map((m) => (
              <div key={m.label} className="rounded-control bg-surface-container-low p-space-sm">
                <dt className="text-label-sm text-ink-subtle uppercase">{m.label}</dt>
                <dd className={cn("mt-1 text-headline-sm", m.cls)}>{m.value}</dd>
              </div>
            ))}
          </dl>

          <section className="flex flex-col gap-space-sm">
            <SectionLabel>Primary Contact</SectionLabel>
            <div className="flex items-center justify-between rounded-card bg-surface-container-low p-space-md">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-surface-container text-accent">
                  <Icon name="person" size={20} />
                </span>
                <div>
                  <p className="text-label-md font-semibold text-ink">{props.contactName}</p>
                  <p className="text-body-sm text-ink-subtle">{props.contactEmail}</p>
                </div>
              </div>
              <a
                href={`mailto:${props.contactEmail}`}
                title={`Email ${props.contactName}`}
                className="rounded-control bg-card p-2 text-accent shadow-level-1 transition-colors hover:bg-surface-container"
              >
                <Icon name="outgoing_mail" size={18} />
              </a>
            </div>
          </section>

          <section className="flex flex-col gap-space-sm">
            <SectionLabel>Recent Interaction Log</SectionLabel>
            {props.interactions.length === 0 ? (
              <p className="rounded-control bg-surface-container-low p-3 text-body-sm text-ink-subtle">No orders recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {props.interactions.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 rounded-control bg-surface-container-low p-3">
                    <Icon name={item.icon} size={18} className={cn("mt-0.5", iconTone[item.tone])} />
                    <div>
                      <p className="text-label-md text-ink">{item.title}</p>
                      <p className="text-body-sm text-ink-subtle">{item.detail}</p>
                      <span className="text-[11px] text-outline">{item.when}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-space-sm">
            <SectionLabel>Account &amp; Billing</SectionLabel>
            <dl className="flex flex-col gap-2">
              {props.details.map((d) => (
                <div key={d.label} className="flex items-center justify-between gap-space-md rounded-control bg-surface-container-low p-3">
                  <dt className="flex items-center gap-2 text-body-md text-ink-subtle">
                    <Icon name={d.icon} size={18} className="text-outline" />
                    {d.label}
                  </dt>
                  <dd className="text-right text-body-md text-ink">{d.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      <div className="flex items-center gap-space-sm bg-surface-container-low p-space-lg">
        <Link href={props.ordersHref} className={buttonClasses({ variant: "primary", size: "lg", className: "flex-1" })}>
          <Icon name="open_in_new" size={18} />
          View Sales Orders
        </Link>
        <Link href={props.closeHref} scroll={false} className={buttonClasses({ variant: "secondary", size: "lg" })}>
          Close
        </Link>
      </div>
    </Overlay>
  );
}
