import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "../../domain/invoice";

const STATUS_TONES: Record<InvoiceStatus, BadgeTone> = { open: "info", overdue: "danger", paid: "success" };

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge tone={STATUS_TONES[status]} dot>
      {INVOICE_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Display-ready invoice (formatting happens in the container). */
export interface InvoiceDocumentProps {
  invoiceNumber: string;
  reference: string;
  status: InvoiceStatus;
  issuer: { name: string; tagline: string };
  billTo: { company: string; contactName: string; email: string };
  facts: ReadonlyArray<{ label: string; value: string }>;
  title: string;
  description: string | null;
  items: ReadonlyArray<{ id: number; title: string; description: string | null; quantity: string; rate: string; total: string }>;
  totals: ReadonlyArray<{ label: string; value: string; strong?: boolean }>;
  payments: ReadonlyArray<{ id: number; date: string; method: string; amount: string; reference: string | null }>;
  paid: string;
  balance: string;
  terms: string;
}

/** Printable invoice: issuer, bill-to, dates, line items, totals, payments and balance due. */
export function InvoiceDocument(props: InvoiceDocumentProps) {
  return (
    <article
      aria-labelledby="invoice-title"
      className="flex flex-col gap-space-lg rounded-card border border-line bg-card p-space-lg shadow-level-1 print:rounded-none print:border-0 print:p-0 print:shadow-none md:p-space-xl"
    >
      <header className="flex flex-col justify-between gap-space-md sm:flex-row sm:items-start">
        <div>
          <p className="text-headline-md text-ink">{props.issuer.name}</p>
          {props.issuer.tagline ? <p className="text-body-sm text-ink-subtle">{props.issuer.tagline}</p> : null}
        </div>
        <div className="sm:text-right">
          <p className="text-label-sm tracking-[0.08em] text-ink-subtle uppercase">Invoice</p>
          <h1 id="invoice-title" className="tabular text-headline-lg text-ink">
            {props.invoiceNumber}
          </h1>
          <div className="mt-1">
            <InvoiceStatusBadge status={props.status} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-space-md border-y border-line-soft py-space-md sm:grid-cols-2">
        <div>
          <p className="text-label-sm tracking-[0.08em] text-ink-subtle uppercase">Bill to</p>
          <p className="mt-1 text-headline-sm text-ink">{props.billTo.company}</p>
          <p className="text-body-sm text-ink-muted">{props.billTo.contactName}</p>
          <p className="text-body-sm text-ink-muted">{props.billTo.email}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-space-md gap-y-1 text-body-sm">
          {props.facts.map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-ink-subtle">{f.label}</dt>
              <dd className="tabular text-right text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <p className="text-headline-sm text-ink">{props.title}</p>
        {props.description ? <p className="text-body-sm text-ink-muted">{props.description}</p> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-body-md">
          <caption className="sr-only">Line items</caption>
          <thead className="border-b border-line">
            <tr className="text-label-sm tracking-[0.05em] text-ink-subtle uppercase">
              <th scope="col" className="py-2 text-left">Description</th>
              <th scope="col" className="py-2 text-right">Qty</th>
              <th scope="col" className="py-2 text-right">Rate</th>
              <th scope="col" className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {props.items.map((item) => (
              <tr key={item.id} className="border-b border-line-soft align-top">
                <td className="py-2 pr-space-md">
                  <span className="block text-ink">{item.title}</span>
                  {item.description ? <span className="block text-body-sm text-ink-subtle">{item.description}</span> : null}
                </td>
                <td className="tabular py-2 text-right text-ink-muted">{item.quantity}</td>
                <td className="tabular py-2 text-right text-ink-muted">{item.rate}</td>
                <td className="tabular py-2 text-right text-ink">{item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <dl className="w-full max-w-xs text-body-md">
          {props.totals.map((t) => (
            <div key={t.label} className={t.strong ? "flex justify-between border-t border-line pt-2 text-headline-sm text-ink" : "flex justify-between py-0.5 text-ink-muted"}>
              <dt>{t.label}</dt>
              <dd className="tabular">{t.value}</dd>
            </div>
          ))}
          <div className="flex justify-between py-0.5 text-success">
            <dt>Paid</dt>
            <dd className="tabular">-{props.paid}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-headline-sm text-ink">
            <dt>Balance due</dt>
            <dd className="tabular">{props.balance}</dd>
          </div>
        </dl>
      </div>

      {props.payments.length > 0 ? (
        <section aria-labelledby="invoice-payments-title">
          <h2 id="invoice-payments-title" className="text-label-sm tracking-[0.08em] text-ink-subtle uppercase">
            Payments received
          </h2>
          <ul className="mt-1 divide-y divide-line-soft text-body-sm">
            {props.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-space-md py-1.5">
                <span className="text-ink-muted">
                  {p.date} · {p.method}
                  {p.reference ? ` · Ref ${p.reference}` : ""}
                </span>
                <span className="tabular text-ink">{p.amount}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="border-t border-line-soft pt-space-md text-body-sm text-ink-subtle">
        <p>
          <span className="font-semibold text-ink-muted">Terms:</span> {props.terms}. Please reference {props.invoiceNumber} ({props.reference}) with your payment.
        </p>
      </footer>
    </article>
  );
}
