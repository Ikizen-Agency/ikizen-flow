import { z } from "zod";
import { dollarsToCents } from "@/shared/domain/money";
import { ORDER_CATEGORIES, ORDER_STATUSES, PAYMENT_TERMS } from "../domain/order";
import { PAYMENT_METHODS } from "../domain/payment";

/** Early settlement incentive offered on the sale form (5%). */
export const EARLY_SETTLEMENT_BPS = 500;
export const MAX_LINE_ITEMS = 25;

const money = z
  .string()
  .trim()
  .transform((value, ctx) => {
    try {
      const cents = dollarsToCents(value);
      if (cents > 0) return cents;
    } catch {
      // fall through to the issue below
    }
    ctx.addIssue({ code: "custom", message: "Enter a positive rate." });
    return z.NEVER;
  });

export const lineItemSchema = z.object({
  title: z.string().trim().min(1, "Each work item needs a title.").max(160),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null),
  quantity: z.coerce.number().int("Quantity must be a whole number.").min(1, "Quantity must be at least 1.").max(10_000),
  unit: z.enum(["unit", "hours"]).default("unit"),
  unitRate: money,
});

const itemsJson = z.string().transform((value, ctx) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    ctx.addIssue({ code: "custom", message: "Work items could not be read." });
    return z.NEVER;
  }
});

const orderReference = z.string().regex(/^SL-\d+$/, "Unknown order reference.");

/** Fields shared by the composer in create and edit mode. */
const composerFields = {
  customerId: z.coerce.number({ error: "Choose a client account." }).int().positive("Choose a client account."),
  category: z.enum(ORDER_CATEGORIES, { error: "Choose a service category." }),
  paymentTerms: z.enum(PAYMENT_TERMS, { error: "Choose a payment schedule." }),
  earlySettlement: z.literal("on").optional(),
  items: itemsJson.pipe(
    z.array(lineItemSchema).min(1, "Add at least one work item.").max(MAX_LINE_ITEMS, `Use at most ${MAX_LINE_ITEMS} work items.`),
  ),
};

type ComposerValues = z.output<z.ZodObject<typeof composerFields>>;

function toOrderCommand({ customerId, category, paymentTerms, earlySettlement, items }: ComposerValues) {
  return {
    customerId,
    category,
    paymentTerms,
    discountBps: earlySettlement ? EARLY_SETTLEMENT_BPS : 0,
    title: items[0]!.title,
    items: items.map(({ unitRate, ...item }) => ({ ...item, unitRateCents: unitRate })),
  };
}

export const createOrderSchema = z
  .object({ ...composerFields, intent: z.enum(["draft", "confirm"]) })
  .transform(({ intent, ...values }) => ({
    ...toOrderCommand(values),
    status: intent === "draft" ? ("draft" as const) : ("pending" as const),
    /** "Confirm & Create Invoice" also moves the new order to invoiced. */
    issueInvoice: intent === "confirm",
  }));

/** The composer reopened on an existing draft / pending order. */
export const updateOrderSchema = z
  .object({ ...composerFields, reference: orderReference })
  .transform(({ reference, ...values }) => {
    // The title follows the first line item (see makeUpdateOrder), so it is not part of the command.
    const { customerId, category, paymentTerms, discountBps, items } = toOrderCommand(values);
    return { reference, input: { customerId, category, paymentTerms, discountBps, items } };
  });

export type CreateOrderValues = z.output<typeof createOrderSchema>;

export const changeOrderStatusSchema = z.object({
  reference: orderReference,
  status: z.enum(ORDER_STATUSES),
});

export interface SaleFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"customerId" | "category" | "paymentTerms" | "items", string[]>>;
}

export const INITIAL_SALE_FORM_STATE: SaleFormState = { status: "idle" };

export interface StatusChangeState {
  status: "idle" | "error";
  message?: string;
}

export const INITIAL_STATUS_CHANGE_STATE: StatusChangeState = { status: "idle" };

export const deleteOrderSchema = z.object({ reference: orderReference });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .optional()
    .transform((v) => v || null);

export const recordPaymentSchema = z
  .object({
    reference: orderReference,
    amount: z
      .string()
      .trim()
      .transform((value, ctx) => {
        try {
          const cents = dollarsToCents(value);
          if (cents > 0) return cents;
        } catch {
          // fall through to the issue below
        }
        ctx.addIssue({ code: "custom", message: "Enter a positive amount." });
        return z.NEVER;
      }),
    method: z.enum(PAYMENT_METHODS, { error: "Choose a payment method." }),
    paidOn: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`))), "Enter a valid date."),
    paymentReference: optionalText(80),
    note: optionalText(500),
  })
  .transform(({ amount, paidOn, ...rest }) => ({
    ...rest,
    amountCents: amount,
    // Midday UTC keeps the calendar day stable across time zones.
    paidAt: paidOn ? new Date(`${paidOn}T12:00:00Z`) : undefined,
  }));

export const deletePaymentSchema = z.object({ paymentId: z.coerce.number().int().positive() });

export interface PaymentFormState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"amount" | "method" | "paidOn" | "paymentReference" | "note", string[]>>;
}

export const INITIAL_PAYMENT_FORM_STATE: PaymentFormState = { status: "idle" };
