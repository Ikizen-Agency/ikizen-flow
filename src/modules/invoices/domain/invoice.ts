/**
 * Invoices are orders that have been issued (status invoiced or completed, with an invoice number).
 * Money rules (balance, payments, completion) live in the sales domain; this module only derives the
 * invoice view of them: list tabs, KPIs, receivables aging and the customer-facing email.
 */
import type { CsvCell } from "@/shared/domain/csv";
import { formatMoney, type Cents } from "@/shared/domain/money";
import { daysBetween, formatDate, toIsoDate } from "@/shared/domain/time";
import { daysOverdue, type EffectiveOrderStatus, type OrderStatus } from "../../sales/domain/order";
import { orderBalance } from "../../sales/domain/payment";

export { INVOICED_ORDER_STATUSES } from "../../sales/domain/order";

export const INVOICE_TABS = ["all", "open", "overdue", "paid"] as const;
export type InvoiceTab = (typeof INVOICE_TABS)[number];

/** Display status of an invoice: paid (completed), overdue (past due and unpaid) or open. */
export type InvoiceStatus = Exclude<InvoiceTab, "all">;

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = { open: "Open", overdue: "Overdue", paid: "Paid" };
export const INVOICE_TAB_LABELS: Record<InvoiceTab, string> = { all: "All", ...INVOICE_STATUS_LABELS };

const TAB_ORDER_STATUS: Record<InvoiceTab, EffectiveOrderStatus | undefined> = {
  all: undefined,
  open: "invoiced",
  overdue: "overdue",
  paid: "completed",
};

/** The effective order status that selects a tab in the order list ("open" = invoiced and not yet overdue). */
export function invoiceTabStatus(tab: InvoiceTab): EffectiveOrderStatus | undefined {
  return TAB_ORDER_STATUS[tab];
}

/** What the invoice aggregations need to know about one invoice. */
export interface InvoiceFact {
  status: OrderStatus;
  amountCents: Cents;
  paidCents: Cents;
  issueDate: Date;
  dueDate: Date;
  paidAt: Date | null;
}

export function invoiceStatus(invoice: Pick<InvoiceFact, "status" | "dueDate">, now: Date): InvoiceStatus {
  if (invoice.status === "completed") return "paid";
  return daysOverdue(invoice, now) > 0 ? "overdue" : "open";
}

export function countInvoicesByTab(invoices: ReadonlyArray<InvoiceFact>, now: Date): Record<InvoiceTab, number> {
  const counts: Record<InvoiceTab, number> = { all: 0, open: 0, overdue: 0, paid: 0 };
  for (const invoice of invoices) {
    counts.all += 1;
    counts[invoiceStatus(invoice, now)] += 1;
  }
  return counts;
}

const oneDecimal = (n: number) => Math.round(n * 10) / 10;

/** Average whole days from issue to payment of paid invoices (one decimal); null when none was paid. */
export function averageDaysToPay(invoices: ReadonlyArray<InvoiceFact>): number | null {
  const paid = invoices.filter((i): i is InvoiceFact & { paidAt: Date } => i.status === "completed" && i.paidAt !== null);
  if (paid.length === 0) return null;
  return oneDecimal(paid.reduce((sum, i) => sum + Math.max(0, daysBetween(i.issueDate, i.paidAt)), 0) / paid.length);
}

export interface InvoicePaymentFact {
  amountCents: Cents;
  paidAt: Date;
}

export interface InvoiceKpis {
  /** Balance of every unpaid invoice (overdue included). */
  outstandingCents: Cents;
  openCount: number;
  overdueCents: Cents;
  overdueCount: number;
  /** Payments received on invoices since the start of the current calendar month. */
  collectedCents: Cents;
  collectedSince: Date;
  averageDaysToPay: number | null;
  paidCount: number;
}

export function computeInvoiceKpis(invoices: ReadonlyArray<InvoiceFact>, payments: ReadonlyArray<InvoicePaymentFact>, now: Date): InvoiceKpis {
  const collectedSince = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const unpaid = invoices.filter((i) => invoiceStatus(i, now) !== "paid");
  const overdue = unpaid.filter((i) => invoiceStatus(i, now) === "overdue");
  const balance = (list: ReadonlyArray<InvoiceFact>) => list.reduce((sum, i) => sum + orderBalance(i), 0);
  return {
    outstandingCents: balance(unpaid),
    openCount: unpaid.length,
    overdueCents: balance(overdue),
    overdueCount: overdue.length,
    collectedCents: payments.filter((p) => p.paidAt >= collectedSince && p.paidAt <= now).reduce((sum, p) => sum + p.amountCents, 0),
    collectedSince,
    averageDaysToPay: averageDaysToPay(invoices),
    paidCount: invoices.length - unpaid.length,
  };
}

export const AGING_BUCKETS = ["current", "1_30", "31_60", "61_90", "90_plus"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Current",
  "1_30": "1-30 days",
  "31_60": "31-60 days",
  "61_90": "61-90 days",
  "90_plus": "90+ days",
};

export function agingBucket(daysPastDue: number): AgingBucket {
  if (daysPastDue <= 0) return "current";
  if (daysPastDue <= 30) return "1_30";
  if (daysPastDue <= 60) return "31_60";
  if (daysPastDue <= 90) return "61_90";
  return "90_plus";
}

/** Accounts receivable aging as of `now`: unpaid invoice balances by days past due. */
export function receivablesAging(invoices: ReadonlyArray<InvoiceFact>, now: Date) {
  const totals = Object.fromEntries(AGING_BUCKETS.map((b) => [b, { cents: 0, count: 0 }])) as Record<AgingBucket, { cents: Cents; count: number }>;
  for (const invoice of invoices) {
    const balance = orderBalance(invoice);
    if (invoice.status !== "invoiced" || balance <= 0) continue;
    const bucket = totals[agingBucket(daysOverdue(invoice, now))];
    bucket.cents += balance;
    bucket.count += 1;
  }
  const buckets = AGING_BUCKETS.map((bucket) => ({ bucket, label: AGING_BUCKET_LABELS[bucket], ...totals[bucket] }));
  return { buckets, totalCents: buckets.reduce((sum, b) => sum + b.cents, 0) };
}

export class InvoiceActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceActionError";
  }
}

/** Why a payment reminder cannot be sent for this invoice (null when it can). */
export function reminderBlockedReason(invoice: Pick<InvoiceFact, "status" | "amountCents" | "paidCents">): string | null {
  if (invoice.status !== "invoiced") return "This invoice is already paid; no reminder is needed.";
  if (orderBalance(invoice) <= 0) return "This invoice has no outstanding balance.";
  return null;
}

export interface InvoiceEmailInput {
  kind: "invoice" | "reminder";
  invoiceNumber: string;
  company: string;
  contactName: string;
  /** The workspace sending the invoice. */
  issuer: string;
  amountCents: Cents;
  balanceCents: Cents;
  issueDate: Date;
  dueDate: Date;
  daysOverdue: number;
  /** Absolute link to the invoice in the app. */
  link: string;
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);
/** Subjects must be one line (the mailer rejects CR/LF). */
const oneLine = (text: string) => text.replace(/[\r\n]+/g, " ").trim();

/** Customer-facing invoice / reminder email: summary of amounts and dates plus a link to the invoice. */
export function invoiceEmail(input: InvoiceEmailInput): { subject: string; text: string; html: string } {
  const due = formatDate(input.dueDate);
  const subject =
    input.kind === "invoice"
      ? `Invoice ${input.invoiceNumber} from ${input.issuer}`
      : input.daysOverdue > 0
        ? `Reminder: invoice ${input.invoiceNumber} is ${input.daysOverdue} day${input.daysOverdue === 1 ? "" : "s"} overdue`
        : `Reminder: invoice ${input.invoiceNumber} is due ${due}`;
  const intro =
    input.kind === "invoice"
      ? `Please find the summary of invoice ${input.invoiceNumber} for ${input.company} below.`
      : `This is a friendly reminder that invoice ${input.invoiceNumber} for ${input.company} has an outstanding balance.`;
  const facts: Array<[string, string]> = [
    ["Invoice", input.invoiceNumber],
    ["Issued", formatDate(input.issueDate)],
    ["Due", due],
    ["Total", formatMoney(input.amountCents)],
    ["Balance due", formatMoney(input.balanceCents)],
  ];
  const text = [
    `Hello ${input.contactName},`,
    "",
    intro,
    "",
    ...facts.map(([label, value]) => `${label}: ${value}`),
    "",
    `View the invoice: ${input.link}`,
    "",
    `Thank you,`,
    input.issuer,
  ].join("\n");
  const html = [
    `<p>Hello ${escapeHtml(input.contactName)},</p>`,
    `<p>${escapeHtml(intro)}</p>`,
    `<table cellpadding="4">${facts.map(([label, value]) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}</table>`,
    `<p><a href="${escapeHtml(input.link)}">View invoice ${escapeHtml(input.invoiceNumber)}</a></p>`,
    `<p>Thank you,<br>${escapeHtml(input.issuer)}</p>`,
  ].join("");
  return { subject: oneLine(subject), text, html };
}

export interface InvoiceCsvRow {
  invoiceNumber: string | null;
  reference: string;
  customerCompany: string;
  status: OrderStatus;
  amountCents: Cents;
  paidCents: Cents;
  issueDate: Date;
  dueDate: Date;
}

const dollars = (cents: Cents) => (cents / 100).toFixed(2);

/** Header + one row per invoice (cells are escaped against formula injection by `toCsv`). */
export function invoiceCsvRows(invoices: ReadonlyArray<InvoiceCsvRow>, now: Date): CsvCell[][] {
  return [
    ["Invoice", "Order", "Client", "Issue Date", "Due Date", "Status", "Total (USD)", "Paid (USD)", "Balance (USD)"],
    ...invoices.map((i) => [
      i.invoiceNumber ?? "",
      i.reference,
      i.customerCompany,
      toIsoDate(i.issueDate),
      toIsoDate(i.dueDate),
      INVOICE_STATUS_LABELS[invoiceStatus(i, now)],
      dollars(i.amountCents),
      dollars(i.paidCents),
      dollars(orderBalance(i)),
    ]),
  ];
}
