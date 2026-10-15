import Link from "next/link";
import { Card, CardHeader } from "@/shared/ui/card";
import { Table, TD, TH, THead, TR } from "@/shared/ui/data-table";
import { Icon } from "@/shared/ui/icon";
import type { EffectiveOrderStatus } from "../../../sales/domain/order";
import { OrderStatusBadge } from "../../../sales/ui/components/order-status-badge";

export interface RecentSaleRow {
  reference: string;
  href: string;
  company: string;
  title: string;
  date: string;
  amount: string;
  status: EffectiveOrderStatus;
}

export function RecentSalesCard({ rows, ledgerHref }: { rows: ReadonlyArray<RecentSaleRow>; ledgerHref: string }) {
  return (
    <Card flush aria-labelledby="recent-sales-title">
      <CardHeader
        className="p-5"
        title={<span id="recent-sales-title">Recent Sales &amp; Transactions</span>}
        description="Live audit of customer invoices and incoming settlements"
        action={
          <Link href={ledgerHref} className="inline-flex items-center gap-1 text-label-md text-accent hover:underline">
            View full ledger
            <Icon name="arrow_forward" size={16} />
          </Link>
        }
      />
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-body-sm text-ink-subtle">No sales recorded yet.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Reference</TH>
              <TH>Client / Organization</TH>
              <TH>Date</TH>
              <TH align="right">Amount</TH>
              <TH align="center">Status</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </TR>
          </THead>
          <tbody>
            {rows.map((r) => (
              <TR key={r.reference}>
                <TD>
                  <Link href={r.href} className="tabular text-label-md text-accent hover:underline">
                    #{r.reference}
                  </Link>
                </TD>
                <TD className="min-w-44">
                  <p className="text-label-md text-ink">{r.company}</p>
                  <p className="text-body-sm text-ink-subtle">{r.title}</p>
                </TD>
                <TD className="tabular whitespace-nowrap">{r.date}</TD>
                <TD align="right" className="whitespace-nowrap text-ink">
                  {r.amount}
                </TD>
                <TD align="center">
                  <OrderStatusBadge status={r.status} />
                </TD>
                <TD>
                  <Link href={r.href} title="Transaction options" aria-label={`Open order ${r.reference}`} className="inline-flex rounded-control p-1 text-ink-subtle hover:bg-well hover:text-ink">
                    <Icon name="more_vert" size={18} />
                  </Link>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
