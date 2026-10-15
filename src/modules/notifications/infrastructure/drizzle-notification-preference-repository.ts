import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { members, notificationPreferences } from "@/server/db/schema";
import type { NotificationPreferenceRepository } from "../application/ports";
import type { NotificationType } from "../domain/notification";
import { DEFAULT_DELIVERY, type NotificationPreference } from "../domain/preferences";

/** Notification preferences of one workspace. */
export class DrizzleNotificationPreferenceRepository implements NotificationPreferenceRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  forMember(memberId: number) {
    return this.db
      .select({ type: notificationPreferences.type, inApp: notificationPreferences.inApp, email: notificationPreferences.email })
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.workspaceId, this.workspaceId), eq(notificationPreferences.memberId, memberId)));
  }

  async save(memberId: number, preferences: ReadonlyArray<NotificationPreference>) {
    if (preferences.length === 0) return;
    const [member] = await this.db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.workspaceId, this.workspaceId)));
    if (!member) return;
    await this.db
      .insert(notificationPreferences)
      .values(preferences.map((p) => ({ workspaceId: this.workspaceId, memberId, type: p.type, inApp: p.inApp, email: p.email })))
      .onConflictDoUpdate({
        target: [notificationPreferences.memberId, notificationPreferences.type],
        set: { inApp: sql`excluded.in_app`, email: sql`excluded.email` },
      });
  }

  async deliveryFor(memberIds: number[], type: NotificationType) {
    if (memberIds.length === 0) return [];
    const rows = await this.db
      .select({ memberId: members.id, email: members.email, inApp: notificationPreferences.inApp, sendEmail: notificationPreferences.email })
      .from(members)
      .leftJoin(notificationPreferences, and(eq(notificationPreferences.memberId, members.id), eq(notificationPreferences.type, type)))
      .where(and(eq(members.workspaceId, this.workspaceId), inArray(members.id, memberIds), isNull(members.removedAt)));
    const byId = new Map(rows.map((r) => [r.memberId, r]));
    return memberIds.flatMap((id) => {
      const row = byId.get(id);
      if (!row) return [];
      return [{ memberId: id, email: row.email, inApp: row.inApp ?? DEFAULT_DELIVERY.inApp, sendEmail: row.sendEmail ?? DEFAULT_DELIVERY.email }];
    });
  }
}
