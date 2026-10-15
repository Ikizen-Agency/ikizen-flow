"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getWorkspaceApp } from "@/server/request-context";
import { NotFoundError } from "../../shared-types";
import { DuplicateCustomerError } from "../application/use-cases";
import { CUSTOMER_TIER_LABELS, CustomerHasDependenciesError } from "../domain/customer";
import {
  bulkCustomerSchema,
  createCustomerSchema,
  customerArchiveSchema,
  customerIdSchema,
  customerLifecycleSchema,
  parseCustomerIds,
  updateCustomerSchema,
  type CreateCustomerState,
  type CustomerActionState,
  type UpdateCustomerState,
} from "./form-schema";

function textEntries(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  return values;
}

/** Creates a customer (and an optional draft order for the initial engagement), then opens its profile. */
export async function createCustomerAction(_prev: CreateCustomerState, formData: FormData): Promise<CreateCustomerState> {
  const { ctx, app } = await getWorkspaceApp();
  const values = textEntries(formData);
  const parsed = createCustomerSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { initialAmountCents, ...input } = parsed.data;
  let customerId: number;
  try {
    const customer = await app.customers.create(input, ctx.member.id);
    customerId = customer.id;
  } catch (error) {
    if (error instanceof DuplicateCustomerError) {
      return { status: "error", fieldErrors: { company: [error.message] }, values };
    }
    console.error("createCustomerAction failed", error);
    return { status: "error", message: "The customer could not be saved. Please try again.", values };
  }

  if (initialAmountCents) {
    await app.sales.create({
      customerId,
      title: "Initial engagement",
      category: "custom_software",
      paymentTerms: "net_30",
      status: "draft",
      items: [{ title: "Initial engagement", quantity: 1, unitRateCents: initialAmountCents }],
    }, ctx.member.id);
  }

  revalidatePath("/customers");
  revalidatePath("/sales");
  revalidatePath("/");
  redirect(`/customers?customer=${customerId}`);
}

function revalidateCustomers() {
  revalidatePath("/customers");
  revalidatePath("/sales");
  revalidatePath("/");
}

const result = (status: CustomerActionState["status"], message: string): CustomerActionState => ({ status, message });

/** Edit dialog: updates every field, then returns to the customer's profile. */
export async function updateCustomerAction(_prev: UpdateCustomerState, formData: FormData): Promise<UpdateCustomerState> {
  const { ctx, app } = await getWorkspaceApp();
  const values = textEntries(formData);
  const parsed = updateCustomerSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  try {
    await app.customers.update(parsed.data.id, parsed.data.patch, ctx.member.id);
  } catch (error) {
    if (error instanceof DuplicateCustomerError) return { status: "error", fieldErrors: { company: [error.message] }, values };
    if (error instanceof NotFoundError) return { status: "error", message: "This customer no longer exists.", values };
    console.error("updateCustomerAction failed", error);
    return { status: "error", message: "The customer could not be saved. Please try again.", values };
  }
  revalidateCustomers();
  redirect(`/customers?customer=${parsed.data.id}`);
}

/** Drawer quick edit of lifecycle status and tier. */
export async function updateCustomerLifecycleAction(_prev: CustomerActionState, formData: FormData): Promise<CustomerActionState> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = customerLifecycleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return result("error", "Choose a valid status and tier.");
  const { id, ...patch } = parsed.data;
  try {
    await app.customers.update(id, patch, ctx.member.id);
  } catch (error) {
    if (error instanceof NotFoundError) return result("error", "This customer no longer exists.");
    console.error("updateCustomerLifecycleAction failed", error);
    return result("error", "The customer could not be updated. Please try again.");
  }
  revalidateCustomers();
  return result("success", "Status and tier saved.");
}

/** Archive / unarchive one customer (row menu and drawer). */
export async function archiveCustomerAction(_prev: CustomerActionState, formData: FormData): Promise<CustomerActionState> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = customerArchiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return result("error", "Invalid request.");
  const changed = await app.customers.archive([parsed.data.id], parsed.data.archived, ctx.member.id);
  if (changed.length === 0) return result("error", parsed.data.archived ? "This customer is already archived." : "This customer is not archived.");
  revalidateCustomers();
  return result("success", `${changed[0]!.company} was ${parsed.data.archived ? "archived" : "restored"}.`);
}

/** Hard delete of one customer; refused (with a suggestion to archive) when it has orders or tasks. */
export async function deleteCustomerAction(_prev: CustomerActionState, formData: FormData): Promise<CustomerActionState> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = customerIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return result("error", "Invalid request.");
  try {
    const customer = await app.customers.delete(parsed.data.id, ctx.member.id);
    revalidateCustomers();
    return result("success", `${customer.company} was deleted.`);
  } catch (error) {
    if (error instanceof CustomerHasDependenciesError || error instanceof NotFoundError) return result("error", error.message);
    console.error("deleteCustomerAction failed", error);
    return result("error", "The customer could not be deleted. Please try again.");
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Bulk actions on the selected rows. Ids are re-checked against the workspace by the repositories. */
export async function bulkCustomerAction(_prev: CustomerActionState, formData: FormData): Promise<CustomerActionState> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = bulkCustomerSchema.safeParse({
    ...Object.fromEntries(formData),
    ids: parseCustomerIds(formData.getAll("ids")),
  });
  if (!parsed.success) return result("error", parsed.error.issues[0]?.message ?? "Invalid request.");
  const input = parsed.data;
  let message: string;
  try {
    switch (input.operation) {
      case "campaign": {
        const s = await app.customers.sendCampaign({ ids: input.ids, subject: input.subject, message: input.message }, ctx.member.id);
        message = `Campaign processed for ${plural(s.total, "customer")}: ${s.sent} sent, ${s.logged} logged to the outbox, ${s.failed} failed.`;
        break;
      }
      case "tier": {
        const changed = await app.customers.applyTier(input.ids, input.tier, ctx.member.id);
        message = `${plural(changed.length, "customer")} moved to the ${CUSTOMER_TIER_LABELS[input.tier]} tier.`;
        break;
      }
      case "archive": {
        const changed = await app.customers.archive(input.ids, true, ctx.member.id);
        message = `${plural(changed.length, "customer")} archived.`;
        break;
      }
      case "delete": {
        const { deleted, skipped } = await app.customers.deleteMany(input.ids, ctx.member.id);
        message = `${plural(deleted.length, "customer")} deleted.`;
        if (skipped.length > 0) {
          message += ` Skipped ${skipped.map((s) => s.customer.company).join(", ")}: they have orders or tasks (archive them instead).`;
        }
        break;
      }
    }
  } catch (error) {
    console.error("bulkCustomerAction failed", error);
    return result("error", "The bulk action could not be completed. Please try again.");
  }
  revalidateCustomers();
  return result("success", message);
}
