"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getWorkspaceApp } from "@/server/request-context";
import { NotFoundError } from "../../shared-types";
import { InvalidOrderTransitionError, OrderNotDeletableError, OrderNotEditableError } from "../domain/order";
import { PaymentRejectedError } from "../domain/payment";
import {
  changeOrderStatusSchema,
  createOrderSchema,
  deleteOrderSchema,
  deletePaymentSchema,
  recordPaymentSchema,
  updateOrderSchema,
  type PaymentFormState,
  type SaleFormState,
  type StatusChangeState,
} from "./form-schema";

function composerErrors(error: z.ZodError): SaleFormState {
  const { fieldErrors } = z.flattenError(error) as { fieldErrors: Record<string, string[] | undefined> };
  return {
    status: "error",
    message: "Please fix the highlighted fields.",
    fieldErrors: {
      customerId: fieldErrors.customerId,
      category: fieldErrors.category,
      paymentTerms: fieldErrors.paymentTerms,
      items: fieldErrors.items,
    },
  };
}

function revalidateSales() {
  revalidatePath("/sales");
  revalidatePath("/invoices", "layout");
  revalidatePath("/reports");
  revalidatePath("/customers");
  revalidatePath("/");
}

/** "Save Draft" / "Confirm & Create Invoice" on the Create New Sale form. */
export async function createOrderAction(_prev: SaleFormState, formData: FormData): Promise<SaleFormState> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = createOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return composerErrors(parsed.error);

  const { issueInvoice, ...input } = parsed.data;
  let reference: string;
  try {
    const order = await app.sales.create({ ...input, taxBps: 0 }, ctx.member.id);
    if (issueInvoice) await app.sales.changeStatus(order.reference, "invoiced", ctx.member.id);
    reference = order.reference;
  } catch (error) {
    if (error instanceof NotFoundError) return { status: "error", fieldErrors: { customerId: ["This client no longer exists."] } };
    console.error("createOrderAction failed", error);
    return { status: "error", message: "The order could not be saved. Please try again." };
  }

  revalidateSales();
  redirect(`/sales?order=${reference}`);
}

/** Moves an order along its lifecycle; the domain rejects transitions that are not allowed. */
export async function changeOrderStatusAction(_prev: StatusChangeState, formData: FormData): Promise<StatusChangeState> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = changeOrderStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Invalid status change." };
  try {
    await app.sales.changeStatus(parsed.data.reference, parsed.data.status, ctx.member.id);
  } catch (error) {
    if (error instanceof InvalidOrderTransitionError || error instanceof NotFoundError) {
      return { status: "error", message: error.message };
    }
    console.error("changeOrderStatusAction failed", error);
    return { status: "error", message: "The status could not be updated. Please try again." };
  }
  revalidateSales();
  return { status: "idle" };
}

/** Composer in edit mode ("Save Changes" on a reopened draft / pending order). */
export async function updateOrderAction(_prev: SaleFormState, formData: FormData): Promise<SaleFormState> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = updateOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return composerErrors(parsed.error);
  try {
    await app.sales.update(parsed.data.reference, { ...parsed.data.input, taxBps: 0 }, ctx.member.id);
  } catch (error) {
    if (error instanceof OrderNotEditableError || error instanceof NotFoundError) return { status: "error", message: error.message };
    console.error("updateOrderAction failed", error);
    return { status: "error", message: "The order could not be saved. Please try again." };
  }
  revalidateSales();
  redirect(`/sales?order=${parsed.data.reference}`);
}

/** Deletes a draft or cancelled order (confirmed in the drawer). */
export async function deleteOrderAction(_prev: StatusChangeState, formData: FormData): Promise<StatusChangeState> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = deleteOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Unknown order reference." };
  try {
    await app.sales.delete(parsed.data.reference, ctx.member.id);
  } catch (error) {
    if (error instanceof OrderNotDeletableError || error instanceof NotFoundError) return { status: "error", message: error.message };
    console.error("deleteOrderAction failed", error);
    return { status: "error", message: "The order could not be deleted. Please try again." };
  }
  revalidateSales();
  redirect("/sales");
}

/** Records a (partial) payment from the order drawer. */
export async function recordPaymentAction(_prev: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = recordPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error) as { fieldErrors: Record<string, string[] | undefined> };
    return { status: "error", fieldErrors: { amount: fieldErrors.amount, method: fieldErrors.method, paidOn: fieldErrors.paidOn, paymentReference: fieldErrors.paymentReference, note: fieldErrors.note } };
  }
  const { reference, paymentReference, ...input } = parsed.data;
  try {
    const { completed } = await app.sales.recordPayment(reference, { ...input, reference: paymentReference }, ctx.member.id);
    revalidateSales();
    return { status: "success", message: completed ? "Payment recorded. The order is paid in full and now completed." : "Payment recorded." };
  } catch (error) {
    if (error instanceof PaymentRejectedError) return { status: "error", fieldErrors: { amount: [error.message] } };
    if (error instanceof NotFoundError || error instanceof InvalidOrderTransitionError) return { status: "error", message: error.message };
    console.error("recordPaymentAction failed", error);
    return { status: "error", message: "The payment could not be recorded. Please try again." };
  }
}

/** Deletes a payment (confirmed); a completed order that is no longer fully paid is reopened as invoiced. */
export async function deletePaymentAction(_prev: StatusChangeState, formData: FormData): Promise<StatusChangeState> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = deletePaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Unknown payment." };
  try {
    await app.sales.deletePayment(parsed.data.paymentId, ctx.member.id);
  } catch (error) {
    if (error instanceof NotFoundError) return { status: "error", message: error.message };
    console.error("deletePaymentAction failed", error);
    return { status: "error", message: "The payment could not be deleted. Please try again." };
  }
  revalidateSales();
  return { status: "idle" };
}
