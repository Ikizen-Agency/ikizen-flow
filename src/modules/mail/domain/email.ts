/** Why an email was sent. Every outgoing email is recorded in the workspace outbox. */
export const EMAIL_KINDS = ["reminder", "invoice", "campaign", "invite", "mention", "support"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

/**
 * Delivery state of an outbox entry:
 * `queued` (persisted, not delivered yet), `sent` (accepted by the SMTP server),
 * `failed` (the transport raised an error), `logged` (no SMTP configured; recorded only).
 */
export const EMAIL_STATUSES = ["queued", "sent", "failed", "logged"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const EMAIL_ENTITY_TYPES = ["customer", "order", "task", "workspace"] as const;
export type EmailEntityType = (typeof EMAIL_ENTITY_TYPES)[number];

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string | null;
}

export interface OutboxEmail extends EmailMessage {
  id: number;
  kind: EmailKind;
  status: EmailStatus;
  error: string | null;
  relatedEntityType: EmailEntityType | null;
  relatedEntityId: number | null;
  createdById: number | null;
  createdAt: Date;
  sentAt: Date | null;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  from: string;
}

export type MailerConfig = { transport: "smtp"; smtp: SmtpConfig } | { transport: "log"; from: string };

export const DEFAULT_MAIL_FROM = "Ikizen Flow <no-reply@ikizen.local>";
export const DEFAULT_SUPPORT_EMAIL = "support@ikizen.local";

/** SMTP when `SMTP_HOST` is set, otherwise the log transport (emails are only recorded in the outbox). */
export function resolveMailerConfig(env: Record<string, string | undefined>): MailerConfig {
  const from = env.SMTP_FROM?.trim() || DEFAULT_MAIL_FROM;
  const host = env.SMTP_HOST?.trim();
  if (!host) return { transport: "log", from };
  const port = Number(env.SMTP_PORT?.trim() || 587);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`Invalid SMTP_PORT: ${env.SMTP_PORT}`);
  const secureFlag = env.SMTP_SECURE?.trim().toLowerCase();
  return {
    transport: "smtp",
    smtp: {
      host,
      port,
      secure: secureFlag ? secureFlag === "true" || secureFlag === "1" : port === 465,
      user: env.SMTP_USER?.trim() || null,
      pass: env.SMTP_PASS ?? null,
      from,
    },
  };
}

export function resolveSupportEmail(env: Record<string, string | undefined>): string {
  return env.SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL;
}

/** Exactly one bare address: no lists (`,` `;`), display names (`<` `>`), whitespace, control characters or extra `@`. */
const EMAIL_PATTERN = /^[^@<>,;\s\u0000-\u001F\u007F]+@[^@<>,;\s\u0000-\u001F\u007F]+$/;

export function isSingleEmailAddress(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

export class InvalidEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEmailError";
  }
}

/** Rejects messages that could never be delivered (and header injection through CR/LF). */
export function assertValidEmail(message: EmailMessage) {
  if (!isSingleEmailAddress(message.to.trim())) throw new InvalidEmailError(`Invalid recipient address: ${message.to}`);
  if (!message.subject.trim()) throw new InvalidEmailError("Email subject is required.");
  if (/[\r\n]/.test(message.subject)) throw new InvalidEmailError("Email subject must be a single line.");
  if (!message.text.trim()) throw new InvalidEmailError("Email body is required.");
}

/** Short, single-line error text to store on a failed outbox entry. */
export function describeDeliveryError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/\s+/g, " ").trim().slice(0, 500) || "Unknown delivery error";
}
