import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { members, notifications } from "@/server/db/schema";
import type { NotificationRepository } from "../application/ports";
import type { NewNotification, Notification } from "../domain/notification";

type Row = typeof notifications.$inferSelect;

const toNotification = (row: Row): Notification => ({
  id: row.id,
  recipientId: row.recipientId,
  type: row.type,
  title: row.title,
  body: row.body,
  href: row.href,
  readAt: row.readAt,
  createdAt: row.createdAt,
});

/** Notifications of one workspace. */
export class DrizzleNotificationRepository implements NotificationRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  private mine(recipientId: number) {
    return and(eq(notifications.workspaceId, this.workspaceId), eq(notifications.recipientId, recipientId));
  }

  async createMany(items: NewNotification[], now: Date) {
    if (items.length === 0) return 0;
    const rows = await this.db
      .insert(notifications)
      .values(
        items.map((n) => ({
          workspaceId: this.workspaceId,
          recipientId: n.recipientId,
          type: n.type,
          title: n.title,
          body: n.body ?? null,
          href: n.href ?? null,
          createdAt: now,
        })),
      )
      .returning({ id: notifications.id });
    return rows.length;
  }

  async listForRecipient(recipientId: number, { page, pageSize }: { page: number; pageSize: number }) {
    const where = this.mine(recipientId);
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(notifications)
        .where(where)
        // Unread first, then newest first.
        .orderBy(asc(sql`${notifications.readAt} is not null`), desc(notifications.createdAt), desc(notifications.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ value: count() }).from(notifications).where(where),
    ]);
    return { items: rows.map(toNotification), total: total?.value ?? 0, page, pageSize };
  }

  async countUnread(recipientId: number) {
    const [row] = await this.db
      .select({ value: count() })
      .from(notifications)
      .where(and(this.mine(recipientId), isNull(notifications.readAt)));
    return row?.value ?? 0;
  }

  async markRead(recipientId: number, id: number, at: Date) {
    const owned = and(this.mine(recipientId), eq(notifications.id, id));
    await this.db.update(notifications).set({ readAt: at }).where(and(owned, isNull(notifications.readAt)));
    const [row] = await this.db.select().from(notifications).where(owned);
    return row ? toNotification(row) : null;
  }

  async markAllRead(recipientId: number, at: Date) {
    const rows = await this.db
      .update(notifications)
      .set({ readAt: at })
      .where(and(this.mine(recipientId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return rows.length;
  }

  async existingMemberIds(ids: number[]) {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.workspaceId, this.workspaceId), inArray(members.id, ids), isNull(members.removedAt)));
    const found = new Set(rows.map((r) => r.id));
    return ids.filter((id) => found.has(id));
  }
}
