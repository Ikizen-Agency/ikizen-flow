import type { Clock } from "../../shared-types";
import { assertValidEmail, describeDeliveryError, type OutboxEmail } from "../domain/email";
import type { EmailOutboxRepository, Mailer, NewOutboxEmail, OutboxQuery } from "./ports";

export interface MailDeps {
  outbox: EmailOutboxRepository;
  mailer: Mailer;
  clock: Clock;
}

/**
 * Persists the email to the workspace outbox (`queued`) and then delivers it, recording the outcome:
 * `sent` / `logged` on success, `failed` with the error text otherwise. Delivery failures never throw;
 * callers inspect the returned entry's `status`. Invalid messages throw `InvalidEmailError` before anything is stored.
 */
export const makeSendEmail =
  ({ outbox, mailer, clock }: MailDeps) =>
  async (email: NewOutboxEmail): Promise<OutboxEmail> => {
    const message = { ...email, to: email.to.trim(), subject: email.subject.trim() };
    assertValidEmail(message);
    const queued = await outbox.enqueue(message, clock());
    try {
      const { status } = await mailer.deliver({ to: message.to, subject: message.subject, text: message.text, html: message.html ?? null });
      const at = clock();
      await outbox.markDelivered(queued.id, status, at);
      return { ...queued, status, sentAt: status === "sent" ? at : null };
    } catch (error) {
      const text = describeDeliveryError(error);
      await outbox.markFailed(queued.id, text);
      return { ...queued, status: "failed", error: text };
    }
  };

export const makeListOutbox =
  ({ outbox }: Pick<MailDeps, "outbox">) =>
  (query: OutboxQuery = {}) =>
    outbox.list(query);
