import { z } from "zod";

export const SUPPORT_TOPICS = ["question", "bug", "billing", "feature"] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export const SUPPORT_TOPIC_LABELS: Record<SupportTopic, string> = {
  question: "Question",
  bug: "Bug report",
  billing: "Billing",
  feature: "Feature request",
};

export const supportRequestSchema = z.object({
  topic: z.enum(SUPPORT_TOPICS, { message: "Choose a topic." }),
  subject: z.string().trim().min(3, "Add a short subject.").max(120, "Use at most 120 characters."),
  message: z.string().trim().min(10, "Describe the issue in at least 10 characters.").max(5000, "Use at most 5000 characters."),
});

export type SupportRequest = z.infer<typeof supportRequestSchema>;

export interface SupportRequester {
  name: string;
  email: string;
  workspace: string;
  page?: string | null;
}

/** Email sent to the support inbox (subject collapsed to one line to prevent header injection). */
export function composeSupportEmail(request: SupportRequest, from: SupportRequester) {
  const subject = `[Ikizen support] ${SUPPORT_TOPIC_LABELS[request.topic]}: ${request.subject.replace(/\s+/g, " ").trim()}`;
  const text = [
    `From: ${from.name} <${from.email}>`,
    `Workspace: ${from.workspace}`,
    `Topic: ${SUPPORT_TOPIC_LABELS[request.topic]}`,
    from.page ? `Page: ${from.page}` : null,
    "",
    request.message,
  ]
    .filter((line) => line !== null)
    .join("\n");
  return { subject, text };
}
