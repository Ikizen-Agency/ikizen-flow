import { z } from "zod";
import { dollarsToCents } from "@/shared/domain/money";
import { ORDER_CATEGORIES, ORDER_STATUSES, PAYMENT_TERMS } from "../domain/order";

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

export const createOrderSchema = z
  .object({
    customerId: z.coerce.number({ error: "Choose a client account." }).int().positive("Choose a client account."),
    category: z.enum(ORDER_CATEGORIES, { error: "Choose a service category." }),
    paymentTerms: z.enum(PAYMENT_TERMS, { error: "Choose a payment schedule." }),
    earlySettlement: z.literal("on").optional(),
    intent: z.enum(["draft", "confirm"]),
    items: itemsJson.pipe(
      z.array(lineItemSchema).min(1, "Add at least one work item.").max(MAX_LINE_ITEMS, `Use at most ${MAX_LINE_ITEMS} work items.`),
    ),
  })
  .transform(({ customerId, category, paymentTerms, earlySettlement, intent, items }) => ({
    customerId,
    category,
    paymentTerms,
    discountBps: earlySettlement ? EARLY_SETTLEMENT_BPS : 0,
    status: intent === "draft" ? ("draft" as const) : ("pending" as const),
    /** "Confirm & Create Invoice" also moves the new order to invoiced. */
    issueInvoice: intent === "confirm",
    title: items[0]!.title,
    items: items.map(({ unitRate, ...item }) => ({ ...item, unitRateCents: unitRate })),
  }));

export type CreateOrderValues = z.output<typeof createOrderSchema>;

export const changeOrderStatusSchema = z.object({
  reference: z.string().regex(/^SL-\d+$/, "Unknown order reference."),
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
