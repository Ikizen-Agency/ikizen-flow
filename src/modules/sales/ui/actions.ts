"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { container } from "@/server/container";
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
    const order = await container.sales.create({ ...input, taxBps: 0 });
    if (issueInvoice) await container.sales.changeStatus(order.reference, "invoiced");
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
  const parsed = changeOrderStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Invalid status change." };
  try {
    await container.sales.changeStatus(parsed.data.reference, parsed.data.status);
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
