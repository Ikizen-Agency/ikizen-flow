"use server";

import { directory } from "@/server/container";
import { getWorkspaceApp } from "@/server/request-context";
import { composeSupportEmail, supportRequestSchema } from "../domain/support-request";

export interface SupportFormState {
  status: "idle" | "sent" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"topic" | "subject" | "message", string>>;
  values?: { topic: string; subject: string; message: string };
}

/** Help page contact form: emails the support inbox (`SUPPORT_EMAIL`) through the workspace outbox. */
export async function sendSupportRequestAction(_prev: SupportFormState, formData: FormData): Promise<SupportFormState> {
  const { ctx, app } = await getWorkspaceApp();
  const values = {
    topic: String(formData.get("topic") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    message: String(formData.get("message") ?? ""),
  };
  const parsed = supportRequestSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: SupportFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<SupportFormState["fieldErrors"]>;
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Check the highlighted fields.", fieldErrors, values };
  }
  const { subject, text } = composeSupportEmail(parsed.data, {
    name: ctx.member.name,
    email: ctx.user.email,
    workspace: ctx.workspace.name,
    page: "/help",
  });
  const email = await app.mail.send({ to: directory.supportEmail, subject, text, kind: "support", relatedEntityType: "workspace", relatedEntityId: ctx.workspace.id, createdById: ctx.member.id });
  if (email.status === "failed") {
    return { status: "error", message: `We could not deliver your message (${email.error}). It was saved in the outbox; please try again later.`, values };
  }
  return {
    status: "sent",
    message:
      email.status === "sent"
        ? `Thanks! Your request was sent to ${directory.supportEmail}. We will reply to ${ctx.user.email}.`
        : `Thanks! Your request was recorded in the outbox for ${directory.supportEmail} (email delivery is not configured on this server).`,
  };
}
