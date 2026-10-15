import "server-only";
import { and, count, desc, eq, type SQL } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { emailOutbox } from "@/server/db/schema";
import type { EmailOutboxRepository, NewOutboxEmail, OutboxQuery } from "../application/ports";
import type { OutboxEmail } from "../domain/email";

type Row = typeof emailOutbox.$inferSelect;

const toEmail = (row: Row): OutboxEmail => ({
  id: row.id,
  to: row.to,
  subject: row.subject,
  text: row.textBody,
  html: row.htmlBody,
  kind: row.kind,
  status: row.status,
  error: row.error,
  relatedEntityType: row.relatedEntityType,
  relatedEntityId: row.relatedEntityId,
  createdById: row.createdById,
  createdAt: row.createdAt,
  sentAt: row.sentAt,
});

/** Email outbox of one workspace. */
export class DrizzleEmailOutbox implements EmailOutboxRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  private owned(id: number) {
    return and(eq(emailOutbox.id, id), eq(emailOutbox.workspaceId, this.workspaceId));
  }

  async enqueue(email: NewOutboxEmail, now: Date) {
    const [row] = await this.db
      .insert(emailOutbox)
      .values({
        workspaceId: this.workspaceId,
        to: email.to,
        subject: email.subject,
        textBody: email.text,
        htmlBody: email.html ?? null,
        kind: email.kind,
        status: "queued",
        relatedEntityType: email.relatedEntityType ?? null,
        relatedEntityId: email.relatedEntityId ?? null,
        createdById: email.createdById ?? null,
        createdAt: now,
      })
      .returning();
    return toEmail(row!);
  }

  async markDelivered(id: number, status: "sent" | "logged", at: Date) {
    await this.db
      .update(emailOutbox)
      .set({ status, error: null, sentAt: status === "sent" ? at : null })
      .where(this.owned(id));
  }

  async markFailed(id: number, error: string) {
    await this.db.update(emailOutbox).set({ status: "failed", error }).where(this.owned(id));
  }

  async findById(id: number) {
    const [row] = await this.db.select().from(emailOutbox).where(this.owned(id));
    return row ? toEmail(row) : null;
  }

  async list({ kind, status, page = 1, pageSize = 20 }: OutboxQuery = {}) {
    const filters: SQL[] = [eq(emailOutbox.workspaceId, this.workspaceId)];
    if (kind) filters.push(eq(emailOutbox.kind, kind));
    if (status) filters.push(eq(emailOutbox.status, status));
    const where = and(...filters);
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(emailOutbox)
        .where(where)
        .orderBy(desc(emailOutbox.createdAt), desc(emailOutbox.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ value: count() }).from(emailOutbox).where(where),
    ]);
    return { items: rows.map(toEmail), total: total?.value ?? 0, page, pageSize };
  }
}
