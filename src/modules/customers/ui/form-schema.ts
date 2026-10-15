import { z } from "zod";
import { dollarsToCents } from "@/shared/domain/money";
import { isSingleEmailAddress } from "../../mail/domain/email";
import { PAYMENT_TERMS } from "../../sales/domain/order";
import { ASSIGNABLE_CUSTOMER_STATUSES, CUSTOMER_TIERS } from "../domain/customer";

/** Statuses a new account may start in (archiving is a later lifecycle step). */
export const NEW_CUSTOMER_STATUSES = ASSIGNABLE_CUSTOMER_STATUSES;

const requiredText = (label: string, max = 120) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

const emailField = () =>
  z
    .string()
    .trim()
    .pipe(z.email("Enter a valid email address."))
    .refine(isSingleEmailAddress, "Enter a single email address.");

export const createCustomerSchema = z
  .object({
    company: requiredText("Company name"),
    tier: z.enum(CUSTOMER_TIERS, { error: "Choose a service tier." }),
    status: z.enum(NEW_CUSTOMER_STATUSES, { error: "Choose a valid status." }),
    industry: requiredText("Industry", 80),
    contactName: requiredText("Key contact"),
    contactEmail: emailField(),
    initialAmount: z
      .string()
      .trim()
      .optional()
      .refine((v) => {
        if (!v) return true;
        try {
          return dollarsToCents(v) > 0;
        } catch {
          return false;
        }
      }, "Enter a positive dollar amount."),
  })
  .transform(({ initialAmount, ...rest }) => ({
    ...rest,
    initialAmountCents: initialAmount ? dollarsToCents(initialAmount) : null,
  }));

export type CreateCustomerValues = z.output<typeof createCustomerSchema>;

export interface CreateCustomerState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.input<typeof createCustomerSchema>, string[]>>;
  /** Submitted values, echoed back so the form keeps them after a failed submit. */
  values?: Record<string, string>;
}

export const INITIAL_CREATE_CUSTOMER_STATE: CreateCustomerState = { status: "idle" };

const customerId = z.coerce.number().int().positive();

/** Edit dialog: every field from the create form plus billing email and payment terms. */
export const updateCustomerSchema = z
  .object({
    id: customerId,
    company: requiredText("Company name"),
    tier: z.enum(CUSTOMER_TIERS, { error: "Choose a service tier." }),
    status: z.enum(ASSIGNABLE_CUSTOMER_STATUSES, { error: "Choose a valid status." }),
    industry: requiredText("Industry", 80),
    contactName: requiredText("Key contact"),
    contactEmail: emailField(),
    billingEmail: z.union([z.literal(""), emailField()]).optional(),
    paymentTerms: z.enum(PAYMENT_TERMS, { error: "Choose payment terms." }),
  })
  .transform(({ id, billingEmail, ...patch }) => ({ id, patch: { ...patch, billingEmail: billingEmail || null } }));

export type UpdateCustomerFieldErrors = Partial<Record<keyof z.input<typeof updateCustomerSchema>, string[]>>;

export interface UpdateCustomerState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: UpdateCustomerFieldErrors;
  values?: Record<string, string>;
}

export const INITIAL_UPDATE_CUSTOMER_STATE: UpdateCustomerState = { status: "idle" };

/** Drawer quick edit: lifecycle status and tier. */
export const customerLifecycleSchema = z.object({
  id: customerId,
  status: z.enum(ASSIGNABLE_CUSTOMER_STATUSES),
  tier: z.enum(CUSTOMER_TIERS),
});

export const customerArchiveSchema = z.object({ id: customerId, archived: z.enum(["true", "false"]).transform((v) => v === "true") });

export const customerIdSchema = z.object({ id: customerId });

export const MAX_BULK_CUSTOMERS = 100;

/** Distinct positive integer ids from repeated `ids` form fields; anything else is dropped. */
export function parseCustomerIds(values: ReadonlyArray<unknown>): number[] {
  const ids = new Set<number>();
  for (const value of values) {
    const n = Number(value);
    if (Number.isInteger(n) && n > 0) ids.add(n);
  }
  return [...ids];
}

const bulkIds = z.array(customerId).min(1, "Select at least one customer.").max(MAX_BULK_CUSTOMERS, `Select at most ${MAX_BULK_CUSTOMERS} customers.`);

export const bulkCustomerSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("campaign"),
    ids: bulkIds,
    subject: z
      .string()
      .trim()
      .min(1, "Subject is required.")
      .max(160, "Subject is too long.")
      .refine((v) => !/[\r\n]/.test(v), "Subject must be a single line."),
    message: z.string().trim().min(1, "Message is required.").max(5000, "Message is too long."),
  }),
  z.object({ operation: z.literal("tier"), ids: bulkIds, tier: z.enum(CUSTOMER_TIERS, { error: "Choose a tier." }) }),
  z.object({ operation: z.literal("archive"), ids: bulkIds }),
  z.object({ operation: z.literal("delete"), ids: bulkIds }),
]);

export type BulkCustomerOperation = z.output<typeof bulkCustomerSchema>["operation"];

/** Result of a row, drawer or bulk mutation, rendered next to the control that triggered it. */
export interface CustomerActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export const INITIAL_CUSTOMER_ACTION_STATE: CustomerActionState = { status: "idle" };
