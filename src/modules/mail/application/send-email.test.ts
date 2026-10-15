import { describe, expect, it } from "vitest";
import { InvalidEmailError, resolveMailerConfig, type OutboxEmail } from "../domain/email";
import type { EmailOutboxRepository, Mailer, NewOutboxEmail } from "./ports";
import { makeSendEmail } from "./use-cases";

const now = new Date("2026-10-14T12:00:00Z");

/** In-memory outbox that records every status transition. */
function fakeOutbox() {
  const rows: OutboxEmail[] = [];
  const transitions: string[] = [];
  const outbox: EmailOutboxRepository = {
    async enqueue(email: NewOutboxEmail, at: Date) {
      const row: OutboxEmail = {
        id: rows.length + 1,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html ?? null,
        kind: email.kind,
        status: "queued",
        error: null,
        relatedEntityType: email.relatedEntityType ?? null,
        relatedEntityId: email.relatedEntityId ?? null,
        createdById: email.createdById ?? null,
        createdAt: at,
        sentAt: null,
      };
      rows.push(row);
      transitions.push("queued");
      return { ...row };
    },
    async markDelivered(id, status, at) {
      Object.assign(rows[id - 1]!, { status, sentAt: status === "sent" ? at : null });
      transitions.push(status);
    },
    async markFailed(id, error) {
      Object.assign(rows[id - 1]!, { status: "failed", error });
      transitions.push("failed");
    },
    async findById(id) {
      return rows[id - 1] ?? null;
    },
    async list() {
      return { items: rows, total: rows.length, page: 1, pageSize: rows.length };
    },
  };
  return { outbox, rows, transitions };
}

/** Fake SMTP transport: succeeds, or throws like a refused connection. */
function fakeTransport(mode: "ok" | "fail" | "log") {
  const delivered: string[] = [];
  const mailer: Mailer = {
    transport: mode === "log" ? "log" : "smtp",
    async deliver(message) {
      if (mode === "fail") throw new Error("connect ECONNREFUSED 127.0.0.1:2525\n  at TCPConnectWrap");
      delivered.push(message.to);
      return { status: mode === "log" ? "logged" : "sent" };
    },
  };
  return { mailer, delivered };
}

const email: NewOutboxEmail = {
  to: " billing@acme.test ",
  subject: "Payment reminder",
  text: "Invoice INV-1 is overdue.",
  kind: "reminder",
  relatedEntityType: "order",
  relatedEntityId: 7,
  createdById: 3,
};

describe("sendEmail", () => {
  it("persists the email as queued, delivers it and records it as sent", async () => {
    const { outbox, rows, transitions } = fakeOutbox();
    const { mailer, delivered } = fakeTransport("ok");
    const result = await makeSendEmail({ outbox, mailer, clock: () => now })(email);

    expect(transitions).toEqual(["queued", "sent"]);
    expect(delivered).toEqual(["billing@acme.test"]);
    expect(result).toMatchObject({ status: "sent", sentAt: now, to: "billing@acme.test", kind: "reminder", relatedEntityId: 7 });
    expect(rows[0]).toMatchObject({ status: "sent", error: null, createdById: 3 });
  });

  it("records a delivery failure without throwing", async () => {
    const { outbox, rows, transitions } = fakeOutbox();
    const result = await makeSendEmail({ outbox, mailer: fakeTransport("fail").mailer, clock: () => now })(email);

    expect(transitions).toEqual(["queued", "failed"]);
    expect(result.status).toBe("failed");
    expect(rows[0]!.error).toBe("connect ECONNREFUSED 127.0.0.1:2525 at TCPConnectWrap");
    expect(rows[0]!.sentAt).toBeNull();
  });

  it("marks emails as logged when no SMTP transport is configured", async () => {
    const { outbox, transitions } = fakeOutbox();
    const result = await makeSendEmail({ outbox, mailer: fakeTransport("log").mailer, clock: () => now })(email);
    expect(transitions).toEqual(["queued", "logged"]);
    expect(result).toMatchObject({ status: "logged", sentAt: null });
  });

  it("rejects invalid messages before storing anything", async () => {
    const { outbox, rows } = fakeOutbox();
    const send = makeSendEmail({ outbox, mailer: fakeTransport("ok").mailer, clock: () => now });
    await expect(send({ ...email, to: "not-an-address" })).rejects.toBeInstanceOf(InvalidEmailError);
    await expect(send({ ...email, subject: "Hi\r\nBcc: victim@x.test" })).rejects.toBeInstanceOf(InvalidEmailError);
    await expect(send({ ...email, text: "  " })).rejects.toBeInstanceOf(InvalidEmailError);
    expect(rows).toHaveLength(0);
  });
});

describe("resolveMailerConfig", () => {
  it("uses the log transport without SMTP_HOST", () => {
    expect(resolveMailerConfig({})).toEqual({ transport: "log", from: "Ikizen Flow <no-reply@ikizen.local>" });
  });

  it("builds an SMTP config from the environment", () => {
    expect(resolveMailerConfig({ SMTP_HOST: "smtp.test", SMTP_PORT: "465", SMTP_USER: "u", SMTP_PASS: "p", SMTP_FROM: "Ops <ops@x.test>" })).toEqual({
      transport: "smtp",
      smtp: { host: "smtp.test", port: 465, secure: true, user: "u", pass: "p", from: "Ops <ops@x.test>" },
    });
    expect(resolveMailerConfig({ SMTP_HOST: "smtp.test" })).toMatchObject({ smtp: { port: 587, secure: false, user: null } });
    expect(() => resolveMailerConfig({ SMTP_HOST: "smtp.test", SMTP_PORT: "abc" })).toThrow(/SMTP_PORT/);
  });
});
