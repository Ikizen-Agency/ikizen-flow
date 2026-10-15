import "server-only";
import nodemailer from "nodemailer";
import type { Mailer } from "../application/ports";
import type { MailerConfig, SmtpConfig } from "../domain/email";

/** Delivers through an SMTP server (nodemailer). Errors propagate so the outbox records `failed`. */
export class SmtpMailer implements Mailer {
  readonly transport = "smtp" as const;
  private readonly transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass ?? "" } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async deliver(message: Parameters<Mailer["deliver"]>[0]) {
    await this.transporter.sendMail({
      from: message.from ?? this.config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html ?? undefined,
    });
    return { status: "sent" as const };
  }
}

/** Development / no-SMTP transport: the outbox entry is the only record (status `logged`). */
export class LogMailer implements Mailer {
  readonly transport = "log" as const;

  async deliver(message: Parameters<Mailer["deliver"]>[0]) {
    if (process.env.NODE_ENV !== "test") console.info(`[mail:log] to=${message.to} subject=${JSON.stringify(message.subject)}`);
    return { status: "logged" as const };
  }
}

export function createMailer(config: MailerConfig): Mailer {
  return config.transport === "smtp" ? new SmtpMailer(config.smtp) : new LogMailer();
}
