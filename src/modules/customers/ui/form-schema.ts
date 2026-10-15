import { z } from "zod";
import { dollarsToCents } from "@/shared/domain/money";
import { CUSTOMER_TIERS } from "../domain/customer";

/** Statuses a new account may start in (archiving is a later lifecycle step). */
export const NEW_CUSTOMER_STATUSES = ["active", "pending_review", "inactive"] as const;

const requiredText = (label: string, max = 120) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

export const createCustomerSchema = z
  .object({
    company: requiredText("Company name"),
    tier: z.enum(CUSTOMER_TIERS, { error: "Choose a service tier." }),
    status: z.enum(NEW_CUSTOMER_STATUSES, { error: "Choose a valid status." }),
    industry: requiredText("Industry", 80),
    contactName: requiredText("Key contact"),
    contactEmail: z.string().trim().pipe(z.email("Enter a valid email address.")),
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
