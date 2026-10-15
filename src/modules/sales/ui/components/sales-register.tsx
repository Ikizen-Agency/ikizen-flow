import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
import { orderStatusTone, type EffectiveOrderStatus } from "../../domain/order";
import { ORDER_STATUS_ICONS, OrderStatusBadge } from "./order-status-badge";

export interface RegisterRow {
  reference: string;
  company: string;
  status: EffectiveOrderStatus;
  amount: string;
  /** Paid / balance indicator; null when no payment was recorded. */
  payment: { label: string; tone: "success" | "warning" } | null;
  date: string;
  href: string;
}

export interface RegisterTab {
  label: string;
  count: number;
  href: string;
  active: boolean;
}

export interface SalesRegisterProps {
  tabs: ReadonlyArray<RegisterTab>;
  rows: ReadonlyArray<RegisterRow>;
  search: { value: string; status?: string };
  exportHref: string;
  footer: ReactNode;
}

const tileTones = {
  success: "bg-success-tint text-success",
  info: "bg-accent-tint text-accent",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
  neutral: "bg-well text-ink-subtle",
};

/** "Recent Sales Register": status tabs, invoice/client filter and the order list (all URL-driven). */
export function SalesRegister({ tabs, rows, search, exportHref, footer }: SalesRegisterProps) {
  return (
    <Card className="flex flex-col gap-space-md" aria-labelledby="register-title">
      <div className="flex items-start justify-between gap-space-md">
        <div>
          <h2 id="register-title" className="text-headline-md text-ink">
            Recent Sales Register
          </h2>
          <p className="text-body-sm text-ink-subtle">Audited logs for billing reconciliation</p>
        </div>
        <a href={exportHref} download title="Export Ledger" aria-label="Export ledger as CSV" className="rounded-control bg-surface-container-low p-2 text-ink-muted hover:bg-surface-container hover:text-ink">
          <Icon name="file_download" size={18} />
        </a>
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-space-xs">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            scroll={false}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-label-sm transition-colors",
              tab.active ? "bg-accent text-white" : "border border-line bg-card text-ink-muted hover:bg-well",
            )}
          >
            {tab.label} ({tab.count})
          </Link>
        ))}
      </nav>

      <form action="/sales" role="search" className="relative">
        {search.status ? <input type="hidden" name="status" value={search.status} /> : null}
        <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-outline" />
        <input
          type="search"
          name="q"
          defaultValue={search.value}
          placeholder="Filter by invoice ID or client..."
          aria-label="Filter by invoice ID or client"
          className="h-[38px] w-full rounded-control bg-surface-container-low pr-4 pl-10 text-body-sm text-ink placeholder:text-ink-placeholder focus:bg-card focus:shadow-focus focus:outline-none"
        />
      </form>

      {rows.length === 0 ? (
        <p className="rounded-card bg-surface-container-low p-space-lg text-center text-body-sm text-ink-subtle">No orders match this view.</p>
      ) : (
        <ul className="flex flex-col gap-space-sm">
          {rows.map((row) => (
            <li key={row.reference}>
              <Link
                href={row.href}
                scroll={false}
                className="flex items-center gap-space-md rounded-card bg-surface-container-low p-space-md transition-colors hover:bg-surface-container"
              >
                <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-control", tileTones[orderStatusTone(row.status)])}>
                  <Icon name={ORDER_STATUS_ICONS[row.status]} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="tabular text-headline-sm text-ink">#{row.reference}</span>
                    <OrderStatusBadge status={row.status} />
                  </span>
                  <span className="block truncate text-body-sm text-ink-subtle">{row.company}</span>
                  {row.payment ? (
                    <span className={cn("tabular block truncate text-body-sm", row.payment.tone === "success" ? "text-success" : "text-warning")}>{row.payment.label}</span>
                  ) : null}
                </span>
                <span className="text-right">
                  <span className="tabular block text-headline-sm text-ink">{row.amount}</span>
                  <span className="block text-body-sm whitespace-nowrap text-ink-subtle">{row.date}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {footer}
    </Card>
  );
}
