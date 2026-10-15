"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspaceApp } from "@/server/request-context";
import { NotFoundError } from "../../shared-types";
import { ReminderNotAllowedError } from "../application/use-cases";

export interface ReminderState {
  status: "idle" | "sent" | "error";
  message?: string;
}

const reminderSchema = z.object({ reference: z.string().trim().regex(/^SL-\d+$/) });

/** "Send Reminder" on an overdue receivable: records a billing activity (no email is sent). */
export async function sendReminderAction(_prev: ReminderState, formData: FormData): Promise<ReminderState> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = reminderSchema.safeParse({ reference: formData.get("reference") });
  if (!parsed.success) return { status: "error", message: "Unknown invoice." };
  try {
    const { company } = await app.dashboard.sendReminder(parsed.data.reference, ctx.member.id);
    revalidatePath("/");
    return { status: "sent", message: `Reminder logged for ${company}.` };
  } catch (error) {
    if (error instanceof ReminderNotAllowedError || error instanceof NotFoundError) return { status: "error", message: error.message };
    console.error("sendReminderAction failed", error);
    return { status: "error", message: "The reminder could not be logged. Please try again." };
  }
}
