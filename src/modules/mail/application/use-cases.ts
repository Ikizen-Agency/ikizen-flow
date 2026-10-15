import { NotFoundError, type Clock } from "../../shared-types";
import { assertCan } from "../../workspaces/domain/permissions";
import type { WorkspaceRole } from "../../workspaces/domain/workspace";
import { assertValidEmail, describeDeliveryError, EmailRetryError, type OutboxEmail } from "../domain/email";
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

/** Who reads or acts on the workspace outbox (it holds customer emails: owners and admins only). */
export interface MailActor {
  role: WorkspaceRole;
  memberId: number;
}

export const OUTBOX_PAGE_SIZE = 15;

export const makeListOutbox =
  ({ outbox }: Pick<MailDeps, "outbox">) =>
  async (actor: MailActor, { page = 1, pageSize = OUTBOX_PAGE_SIZE, ...filters }: OutboxQuery = {}) => {
    assertCan(actor.role, "mail.manage");
    return outbox.list({ ...filters, page: Math.max(1, page), pageSize: Math.min(100, Math.max(1, pageSize)) });
  };

/** One outbox entry of this workspace, or null. */
export const makeGetOutboxEmail =
  ({ outbox }: Pick<MailDeps, "outbox">) =>
  async (actor: MailActor, id: number) => {
    assertCan(actor.role, "mail.manage");
    return outbox.findById(id);
  };

/** Delivers a failed entry again through the current transport and records the new outcome. */
export const makeRetryEmail =
  ({ outbox, mailer, clock }: MailDeps) =>
  async (actor: MailActor, id: number): Promise<OutboxEmail> => {
    assertCan(actor.role, "mail.manage");
    const email = await outbox.findById(id);
    if (!email) throw new NotFoundError("Email", id);
    if (email.status !== "failed") throw new EmailRetryError("Only failed emails can be retried.");
    try {
      const { status } = await mailer.deliver({ to: email.to, subject: email.subject, text: email.text, html: email.html ?? null });
      const at = clock();
      await outbox.markDelivered(id, status, at);
      return { ...email, status, error: null, sentAt: status === "sent" ? at : null };
    } catch (error) {
      const text = describeDeliveryError(error);
      await outbox.markFailed(id, text);
      return { ...email, status: "failed", error: text };
    }
  };

/** Active members of the workspace, enough to find the actor's own address. */
export interface MemberEmailLookup {
  findById(id: number): Promise<{ email: string } | null>;
}

/**
 * "Send test email" from Settings > Email. The recipient is always the acting member's own address (looked up
 * from the actor, never taken as input), so the button cannot be used to email arbitrary people.
 */
export const makeSendTestEmail =
  ({ sendEmail, members }: { sendEmail: (email: NewOutboxEmail) => Promise<OutboxEmail>; members: MemberEmailLookup }) =>
  async (actor: MailActor) => {
    assertCan(actor.role, "mail.manage");
    const self = await members.findById(actor.memberId);
    if (!self) throw new NotFoundError("Member", actor.memberId);
    return sendEmail({
      to: self.email,
      subject: "Ikizen Flow test email",
      text: "This is a test email from Ikizen Flow. If you can read it, outgoing email works for your workspace.",
      kind: "test",
      relatedEntityType: "workspace",
      createdById: actor.memberId,
    });
  };
