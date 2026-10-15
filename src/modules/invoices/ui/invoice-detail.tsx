import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getWorkspaceApp } from "@/server/request-context";
import { formatMoney } from "@/shared/domain/money";
import { formatDate, toIsoDate } from "@/shared/domain/time";
import { Icon } from "@/shared/ui/icon";
import { OrderPayments } from "../../sales/ui/components/order-payments";
import { OPEN_ORDER_STATUSES, PAYMENT_TERMS_LABELS } from "../../sales/domain/order";
import { orderBalance, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "../../sales/domain/payment";
import { invoiceStatus } from "../domain/invoice";
import { InvoiceActionBar } from "./components/invoice-actions";
import { InvoiceDocument } from "./components/invoice-document";

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Container for /invoices/[number]: printable invoice, actions, and the shared payments panel. */
export async function InvoiceDetailView({ params }: { params: Promise<{ number: string }> }) {
  await connection();
  const number = decodeSegment((await params).number);
  const { ctx, app } = await getWorkspaceApp(`/invoices/${encodeURIComponent(number)}`);
  const invoice = await app.invoices.get(number);
  if (!invoice) notFound();
  const { order, customer, payments } = invoice;
  const now = app.clock();
  const status = invoiceStatus(order, now);
  const balanceCents = orderBalance(order);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-space-lg">
      <div className="flex flex-col gap-space-md print:hidden">
        <nav aria-label="Back" className="flex flex-wrap items-center gap-space-md text-body-sm">
          <Link href="/invoices" className="inline-flex items-center gap-1 text-ink-muted hover:text-ink">
            <Icon name="arrow_back" size={16} />
            All invoices
          </Link>
          <Link href={`/sales?order=${encodeURIComponent(order.reference)}`} className="inline-flex items-center gap-1 text-ink-muted hover:text-ink">
            <Icon name="open_in_new" size={16} />
            Order {order.reference}
          </Link>
        </nav>
        <InvoiceActionBar invoiceNumber={number} company={customer.company} balance={formatMoney(balanceCents)} unpaid={status !== "paid" && balanceCents > 0} />
      </div>

      <InvoiceDocument
        invoiceNumber={number}
        reference={order.reference}
        status={status}
        issuer={{ name: ctx.workspace.name, tagline: ctx.workspace.tagline }}
        billTo={{ company: customer.company, contactName: customer.contactName, email: customer.billingEmail ?? customer.contactEmail }}
        facts={[
          { label: "Issue date", value: formatDate(order.issueDate) },
          { label: "Due date", value: formatDate(order.dueDate) },
          { label: "Order", value: order.reference },
          ...(order.paidAt && status === "paid" ? [{ label: "Paid on", value: formatDate(order.paidAt) }] : []),
        ]}
        title={order.title}
        description={order.description}
        items={order.items.map((i) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          quantity: i.unit === "hours" ? `${i.quantity} hrs` : String(i.quantity),
          rate: formatMoney(i.unitRateCents),
          total: formatMoney(i.quantity * i.unitRateCents),
        }))}
        totals={[
          { label: "Subtotal", value: formatMoney(order.subtotalCents) },
          { label: "Discount", value: `-${formatMoney(order.discountCents)}` },
          { label: "Tax", value: formatMoney(order.taxCents) },
          { label: "Total", value: formatMoney(order.amountCents), strong: true },
        ]}
        payments={payments.map((p) => ({ id: p.id, date: formatDate(p.paidAt), method: PAYMENT_METHOD_LABELS[p.method], amount: formatMoney(p.amountCents), reference: p.reference }))}
        paid={formatMoney(order.paidCents)}
        balance={formatMoney(balanceCents)}
        terms={PAYMENT_TERMS_LABELS[order.paymentTerms]}
      />

      <div id="record-payment" className="rounded-card border border-line bg-card p-5 shadow-level-1 print:hidden">
        <OrderPayments
          key={`${order.reference}-${order.paidCents}`}
          reference={order.reference}
          total={formatMoney(order.amountCents)}
          paid={formatMoney(order.paidCents)}
          balance={formatMoney(balanceCents)}
          paidRatio={order.amountCents > 0 ? order.paidCents / order.amountCents : 1}
          payments={payments.map((p) => ({
            id: p.id,
            amount: formatMoney(p.amountCents),
            method: PAYMENT_METHOD_LABELS[p.method],
            date: formatDate(p.paidAt),
            reference: p.reference,
            note: p.note,
            recordedBy: p.recordedByName,
          }))}
          canRecord={OPEN_ORDER_STATUSES.includes(order.status) && balanceCents > 0}
          balanceInput={(balanceCents / 100).toFixed(2)}
          todayInput={toIsoDate(now)}
          methodOptions={PAYMENT_METHODS.map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] }))}
        />
      </div>
    </div>
  );
}

export function InvoiceDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-4xl animate-pulse flex-col gap-space-lg" aria-busy="true" aria-label="Loading invoice">
      <div className="h-10 w-1/2 rounded-card bg-well" />
      <div className="h-[40rem] rounded-card bg-well" />
    </div>
  );
}
