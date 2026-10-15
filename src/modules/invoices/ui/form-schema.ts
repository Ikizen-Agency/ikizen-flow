import { z } from "zod";
import type { EmailStatus } from "../../mail/domain/email";

/** Invoice numbers as stored ("INV-2047"): letters, digits and dashes only. */
export const invoiceNumberSchema = z.object({
  invoiceNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{1,40}$/, "Unknown invoice."),
});

export const issueInvoiceSchema = z.object({
  reference: z
    .string()
    .trim()
    .regex(/^SL-\d{1,10}$/, "Unknown order."),
});

export interface InvoiceActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export const INITIAL_INVOICE_ACTION_STATE: InvoiceActionState = { status: "idle" };

/** User-facing result of an outbox delivery (sent, logged without SMTP, or failed). */
export function outboxResultMessage(what: "Invoice" | "Reminder", email: { status: EmailStatus; error: string | null }, to: string): InvoiceActionState {
  if (email.status === "sent") return { status: "success", message: `${what} emailed to ${to}.` };
  if (email.status === "failed") {
    return { status: "error", message: `Delivery of the ${what.toLowerCase()} to ${to} failed: ${email.error ?? "unknown error"}. The attempt is recorded in the outbox.` };
  }
  return { status: "success", message: `${what} recorded in the outbox for ${to} (SMTP is not configured, so it was not delivered).` };
}
