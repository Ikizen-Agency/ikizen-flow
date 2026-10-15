import type { ActivityRepository } from "../../activity/application/ports";
import type { CustomerRepository } from "../../customers/application/ports";
import type { NewOutboxEmail } from "../../mail/application/ports";
import type { OutboxEmail } from "../../mail/domain/email";
import type { OrderRepository, PaymentRepository } from "../../sales/application/ports";
import { daysOverdue } from "../../sales/domain/order";
import { orderBalance } from "../../sales/domain/payment";
import { NotFoundError, type Clock } from "../../shared-types";
import {
  computeInvoiceKpis,
  countInvoicesByTab,
  invoiceEmail,
  InvoiceActionError,
  invoiceTabStatus,
  reminderBlockedReason,
} from "../domain/invoice";
import type { InvoiceListQuery } from "./list-params";
import type { InvoiceRepository } from "./ports";

export type SendEmail = (email: NewOutboxEmail) => Promise<OutboxEmail>;

export interface InvoiceDeps {
  invoices: InvoiceRepository;
  orders: OrderRepository;
  payments: PaymentRepository;
  customers: CustomerRepository;
  activity: ActivityRepository;
  clock: Clock;
  sendEmail: SendEmail;
}

/** Issued invoices filtered by tab, search, customer and issue date (reuses the order list query). */
export const makeListInvoices =
  ({ orders, clock }: Pick<InvoiceDeps, "orders" | "clock">) =>
  ({ tab, search, customerId, issuedFrom, issuedTo, page, pageSize }: InvoiceListQuery) =>
    orders.list({ invoicedOnly: true, status: invoiceTabStatus(tab), search, customerId, issuedFrom, issuedTo, page, pageSize, asOf: clock() });

/** KPI tiles and tab counts. */
export const makeGetInvoiceOverview =
  ({ invoices, clock }: Pick<InvoiceDeps, "invoices" | "clock">) =>
  async () => {
    const now = clock();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [facts, collected] = await Promise.all([invoices.facts(), invoices.paymentsBetween(monthStart, new Date(now.getTime() + 1))]);
    return { now, kpis: computeInvoiceKpis(facts, collected, now), counts: countInvoicesByTab(facts, now) };
  };

/** Full invoice (order with items, customer billing info, payments) or null when unknown in this workspace. */
export const makeGetInvoice =
  ({ invoices, orders, payments, customers }: Pick<InvoiceDeps, "invoices" | "orders" | "payments" | "customers">) =>
  async (invoiceNumber: string) => {
    const reference = await invoices.referenceFor(invoiceNumber);
    if (!reference) return null;
    const order = await orders.findByReference(reference);
    if (!order) return null;
    const [customer, history] = await Promise.all([customers.findById(order.customerId), payments.listForOrder(order.id)]);
    if (!customer) return null;
    return { order, customer, payments: history };
  };

export type InvoiceDetail = NonNullable<Awaited<ReturnType<ReturnType<typeof makeGetInvoice>>>>;

export interface InvoiceSender {
  /** Workspace name shown as the issuer. */
  issuer: string;
  /** Public origin of the app, for the invoice link. */
  baseUrl: string;
}

function makeInvoiceMail(kind: "invoice" | "reminder") {
  return (deps: InvoiceDeps) => async (invoiceNumber: string, actorId: number | null, sender: InvoiceSender) => {
    const invoice = await makeGetInvoice(deps)(invoiceNumber);
    if (!invoice) throw new NotFoundError("Invoice", invoiceNumber);
    const { order, customer } = invoice;
    if (kind === "reminder") {
      const blocked = reminderBlockedReason(order);
      if (blocked) throw new InvoiceActionError(blocked);
    }
    const now = deps.clock();
    const recipient = customer.billingEmail ?? customer.contactEmail;
    const content = invoiceEmail({
      kind,
      invoiceNumber,
      company: customer.company,
      contactName: customer.contactName,
      issuer: sender.issuer,
      amountCents: order.amountCents,
      balanceCents: orderBalance(order),
      issueDate: order.issueDate,
      dueDate: order.dueDate,
      daysOverdue: daysOverdue(order, now),
      link: `${sender.baseUrl.replace(/\/+$/, "")}/invoices/${encodeURIComponent(invoiceNumber)}`,
    });
    const email = await deps.sendEmail({ to: recipient, ...content, kind, relatedEntityType: "order", relatedEntityId: order.id, createdById: actorId });
    await deps.activity.record({
      actorId,
      message: `${kind === "invoice" ? "sent invoice" : "sent a payment reminder for invoice"} #${invoiceNumber} to ${customer.company} (${email.status})`,
      category: "billing",
      entityType: "order",
      entityId: order.id,
      createdAt: now,
    });
    return { email, recipient };
  };
}

/** Emails the invoice summary + link to the customer's billing (or contact) address through the outbox. */
export const makeSendInvoice = makeInvoiceMail("invoice");
/** Payment reminder for an unpaid invoice (open or overdue); paid invoices are refused with `InvoiceActionError`. */
export const makeSendInvoiceReminder = makeInvoiceMail("reminder");

const INVOICEABLE_LIMIT = 50;

/** Pending and processing orders that can be issued as invoices. */
export const makeListInvoiceableOrders =
  ({ invoices }: Pick<InvoiceDeps, "invoices">) =>
  () =>
    invoices.invoiceable(INVOICEABLE_LIMIT);
