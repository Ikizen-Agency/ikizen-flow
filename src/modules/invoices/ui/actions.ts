"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveAuthEnv } from "@/modules/auth/domain/auth-env";
import { InvalidEmailError } from "@/modules/mail/domain/email";
import { InvalidOrderTransitionError } from "@/modules/sales/domain/order";
import { getWorkspaceApp } from "@/server/request-context";
import { NotFoundError } from "../../shared-types";
import { InvoiceActionError } from "../domain/invoice";
import { invoiceNumberSchema, issueInvoiceSchema, outboxResultMessage, type InvoiceActionState } from "./form-schema";

function revalidateBilling() {
  revalidatePath("/invoices", "layout");
  revalidatePath("/sales");
  revalidatePath("/reports");
  revalidatePath("/");
}

function knownError(error: unknown): InvoiceActionState | null {
  if (error instanceof NotFoundError || error instanceof InvoiceActionError || error instanceof InvalidOrderTransitionError || error instanceof InvalidEmailError) {
    return { status: "error", message: error.message };
  }
  return null;
}

async function mailInvoice(kind: "invoice" | "reminder", formData: FormData): Promise<InvoiceActionState> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = invoiceNumberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Unknown invoice." };
  const sender = { issuer: ctx.workspace.name, baseUrl: resolveAuthEnv(process.env).baseURL };
  try {
    const send = kind === "invoice" ? app.invoices.send : app.invoices.sendReminder;
    const { email, recipient } = await send(parsed.data.invoiceNumber, ctx.member.id, sender);
    revalidateBilling();
    return outboxResultMessage(kind === "invoice" ? "Invoice" : "Reminder", email, recipient);
  } catch (error) {
    const known = knownError(error);
    if (known) return known;
    console.error(`${kind} email failed`, error);
    return { status: "error", message: "The email could not be sent. Please try again." };
  }
}

/** "Send invoice": emails the invoice summary + link to the client through the outbox. */
export async function sendInvoiceAction(_prev: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  return mailInvoice("invoice", formData);
}

/** "Send reminder": only for unpaid (open or overdue) invoices. */
export async function sendInvoiceReminderAction(_prev: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  return mailInvoice("reminder", formData);
}

/** "Mark as paid": settles the remaining balance through the sales lifecycle (records the payment, completes the order). */
export async function markInvoicePaidAction(_prev: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = invoiceNumberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Unknown invoice." };
  try {
    const invoice = await app.invoices.get(parsed.data.invoiceNumber);
    if (!invoice) throw new NotFoundError("Invoice", parsed.data.invoiceNumber);
    await app.sales.changeStatus(invoice.order.reference, "completed", ctx.member.id);
  } catch (error) {
    const known = knownError(error);
    if (known) return known;
    console.error("markInvoicePaidAction failed", error);
    return { status: "error", message: "The invoice could not be marked as paid. Please try again." };
  }
  revalidateBilling();
  return { status: "success", message: `Invoice ${parsed.data.invoiceNumber} is paid in full.` };
}

/** "Issue invoice" for a pending / processing order; opens the new invoice. */
export async function issueInvoiceAction(_prev: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = issueInvoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Choose an order to invoice." };
  let invoiceNumber: string | null = null;
  try {
    await app.sales.changeStatus(parsed.data.reference, "invoiced", ctx.member.id);
    invoiceNumber = (await app.sales.get(parsed.data.reference))?.invoiceNumber ?? null;
  } catch (error) {
    const known = knownError(error);
    if (known) return known;
    console.error("issueInvoiceAction failed", error);
    return { status: "error", message: "The invoice could not be issued. Please try again." };
  }
  revalidateBilling();
  if (invoiceNumber) redirect(`/invoices/${encodeURIComponent(invoiceNumber)}`);
  return { status: "success", message: "Invoice issued." };
}
