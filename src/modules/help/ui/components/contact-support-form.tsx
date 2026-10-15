"use client";

import { useActionState } from "react";
import { Button } from "@/shared/ui/button";
import { Field, Input, Select, Textarea } from "@/shared/ui/input";
import { SUPPORT_TOPIC_LABELS, SUPPORT_TOPICS } from "../../domain/support-request";
import { sendSupportRequestAction, type SupportFormState } from "../actions";

/** Contact support form (Server Action + field errors). Resets after a successful send. */
export function ContactSupportForm({ replyTo }: { replyTo: string }) {
  const [state, action, pending] = useActionState<SupportFormState, FormData>(sendSupportRequestAction, { status: "idle" });
  const errors = state.fieldErrors ?? {};
  const values = state.status === "error" ? state.values : undefined;
  const invalid = (key: keyof typeof errors) => (errors[key] ? { "aria-invalid": true as const, "aria-describedby": `support-${key}-error` } : {});

  return (
    <form action={action} className="flex flex-col gap-space-md" key={state.status === "sent" ? state.message : "form"}>
      <div className="grid gap-space-md sm:grid-cols-[180px_1fr]">
        <Field label="Topic" htmlFor="support-topic" error={errors.topic}>
          <Select id="support-topic" name="topic" defaultValue={values?.topic ?? "question"} {...invalid("topic")}>
            {SUPPORT_TOPICS.map((t) => (
              <option key={t} value={t}>
                {SUPPORT_TOPIC_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Subject" htmlFor="support-subject" error={errors.subject}>
          <Input id="support-subject" name="subject" required maxLength={120} defaultValue={values?.subject} placeholder="Short summary" {...invalid("subject")} />
        </Field>
      </div>
      <Field label="Message" htmlFor="support-message" error={errors.message} hint={`We reply to ${replyTo}.`}>
        <Textarea
          id="support-message"
          name="message"
          required
          rows={5}
          maxLength={5000}
          defaultValue={values?.message}
          placeholder="What happened, what did you expect, and which page were you on?"
          {...invalid("message")}
        />
      </Field>
      <div className="flex flex-col-reverse gap-space-sm sm:flex-row sm:items-center sm:justify-between">
        <p role="status" aria-live="polite" className={state.status === "error" ? "text-body-sm text-danger-strong" : "text-body-sm text-success-strong"}>
          {state.message}
        </p>
        <Button type="submit" icon="send" disabled={pending}>
          {pending ? "Sending..." : "Send message"}
        </Button>
      </div>
    </form>
  );
}
