import type { Page, PageRequest } from "../../shared-types";
import type { EmailEntityType, EmailKind, EmailMessage, EmailStatus, OutboxEmail } from "../domain/email";

/** Delivery transport. `sent` means the message left the app; `logged` means it was only recorded. */
export interface Mailer {
  readonly transport: "smtp" | "log";
  deliver(message: EmailMessage & { from?: string }): Promise<{ status: "sent" | "logged" }>;
}

export interface NewOutboxEmail extends EmailMessage {
  kind: EmailKind;
  relatedEntityType?: EmailEntityType | null;
  relatedEntityId?: number | null;
  createdById?: number | null;
}

export interface OutboxQuery extends PageRequest {
  kind?: EmailKind;
  status?: EmailStatus;
}

/** Outbox of one workspace (the adapter is constructed for a workspace). */
export interface EmailOutboxRepository {
  enqueue(email: NewOutboxEmail, now: Date): Promise<OutboxEmail>;
  markDelivered(id: number, status: "sent" | "logged", at: Date): Promise<void>;
  markFailed(id: number, error: string): Promise<void>;
  findById(id: number): Promise<OutboxEmail | null>;
  list(query?: OutboxQuery): Promise<Page<OutboxEmail>>;
}
