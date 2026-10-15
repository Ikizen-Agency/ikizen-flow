"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getWorkspaceApp } from "@/server/request-context";
import { NotFoundError } from "../../shared-types";
import { InvalidOrderTransitionError } from "../domain/order";
import { changeOrderStatusSchema, createOrderSchema, type SaleFormState, type StatusChangeState } from "./form-schema";

function revalidateSales() {
  revalidatePath("/sales");
  revalidatePath("/customers");
  revalidatePath("/");
}

/** "Save Draft" / "Confirm & Create Invoice" on the Create New Sale form. */
export async function createOrderAction(_prev: SaleFormState, formData: FormData): Promise<SaleFormState> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = createOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
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
