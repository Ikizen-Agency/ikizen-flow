"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { InvalidEmailError } from "@/modules/mail/domain/email";
import { directory } from "@/server/container";
import { getWorkspaceApp } from "@/server/request-context";
import { outboxResultMessage } from "../../invoices/ui/form-schema";
import { NotFoundError } from "../../shared-types";
import { ReminderNotAllowedError } from "../application/use-cases";

export interface ReminderState {
  status: "idle" | "sent" | "error";
  message?: string;
}

const reminderSchema = z.object({ reference: z.string().trim().regex(/^SL-\d+$/) });

/** "Send Reminder" on an overdue receivable: emails the customer, records a billing activity, notifies the order's creator. */
export async function sendReminderAction(_prev: ReminderState, formData: FormData): Promise<ReminderState> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = reminderSchema.safeParse({ reference: formData.get("reference") });
  if (!parsed.success) return { status: "error", message: "Unknown invoice." };
  try {
    const { email, recipient, company } = await app.dashboard.sendReminder(parsed.data.reference, ctx.member.id, { issuer: ctx.workspace.name, baseUrl: directory.baseUrl });
    revalidatePath("/");
    revalidatePath("/invoices", "layout");
    if (!email || !recipient) return { status: "sent", message: `Reminder logged for ${company}.` };
    const result = outboxResultMessage("Reminder", email, recipient);
    return { status: result.status === "error" ? "error" : "sent", message: result.message };
  } catch (error) {
    if (error instanceof ReminderNotAllowedError || error instanceof NotFoundError || error instanceof InvalidEmailError) return { status: "error", message: error.message };
    console.error("sendReminderAction failed", error);
    return { status: "error", message: "The reminder could not be sent. Please try again." };
  }
}
