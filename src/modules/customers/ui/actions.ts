"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { container } from "@/server/container";
import { DuplicateCustomerError } from "../application/use-cases";
import { createCustomerSchema, type CreateCustomerState } from "./form-schema";

function textEntries(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  return values;
}

/** Creates a customer (and an optional draft order for the initial engagement), then opens its profile. */
export async function createCustomerAction(_prev: CreateCustomerState, formData: FormData): Promise<CreateCustomerState> {
  const values = textEntries(formData);
  const parsed = createCustomerSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { initialAmountCents, ...input } = parsed.data;
  let customerId: number;
  try {
    const customer = await container.customers.create(input);
    customerId = customer.id;
  } catch (error) {
    if (error instanceof DuplicateCustomerError) {
      return { status: "error", fieldErrors: { company: [error.message] }, values };
    }
    console.error("createCustomerAction failed", error);
    return { status: "error", message: "The customer could not be saved. Please try again.", values };
  }

  if (initialAmountCents) {
    await container.sales.create({
      customerId,
      title: "Initial engagement",
      category: "custom_software",
      paymentTerms: "net_30",
      status: "draft",
      items: [{ title: "Initial engagement", quantity: 1, unitRateCents: initialAmountCents }],
    });
  }

  revalidatePath("/customers");
  revalidatePath("/sales");
  revalidatePath("/");
  redirect(`/customers?customer=${customerId}`);
}
