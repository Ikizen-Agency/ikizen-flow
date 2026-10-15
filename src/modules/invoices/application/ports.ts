import type { OrderStatus } from "../../sales/domain/order";
import type { InvoiceFact, InvoicePaymentFact } from "../domain/invoice";

/** An order that can be issued as an invoice (pending or processing). */
export interface InvoiceableOrder {
  reference: string;
  customerCompany: string;
  title: string;
  status: OrderStatus;
  amountCents: number;
  issueDate: Date;
}

/** Invoice read model of one workspace (orders of other workspaces are unreachable). */
export interface InvoiceRepository {
  /** Every issued invoice (invoiced / completed with an invoice number) with its paid total. */
  facts(): Promise<InvoiceFact[]>;
  /** Payments received on issued invoices within [from, to). */
  paymentsBetween(from: Date, to: Date): Promise<InvoicePaymentFact[]>;
  /** Order reference of an issued invoice, or null when the number is unknown in this workspace. */
  referenceFor(invoiceNumber: string): Promise<string | null>;
  /** Pending and processing orders, newest first. */
  invoiceable(limit: number): Promise<InvoiceableOrder[]>;
}
