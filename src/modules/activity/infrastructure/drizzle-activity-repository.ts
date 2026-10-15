import "server-only";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { activityEvents, members } from "@/server/db/schema";
import type { ActivityEntityType, NewActivityEvent } from "../domain/activity";
import type { ActivityRepository } from "../application/ports";

/** Activity log of one workspace. */
export class DrizzleActivityRepository implements ActivityRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  private select() {
    return this.db
      .select({
        id: activityEvents.id,
        actorName: members.name,
        message: activityEvents.message,
        category: activityEvents.category,
        entityType: activityEvents.entityType,
        entityId: activityEvents.entityId,
        createdAt: activityEvents.createdAt,
      })
      .from(activityEvents)
      .leftJoin(members, eq(members.id, activityEvents.actorId));
  }

  recent(limit: number) {
    return this.select()
      .where(eq(activityEvents.workspaceId, this.workspaceId))
      .orderBy(desc(activityEvents.createdAt), desc(activityEvents.id)).limit(limit);
  }

  forEntity(entityType: ActivityEntityType, entityId: number, limit: number) {
    return this.select()
      .where(
        and(
          eq(activityEvents.workspaceId, this.workspaceId),
          eq(activityEvents.entityType, entityType),
          eq(activityEvents.entityId, entityId),
        ),
      )
      .orderBy(desc(activityEvents.createdAt), desc(activityEvents.id))
      .limit(limit);
  }

  async record(event: NewActivityEvent) {
    await this.db.insert(activityEvents).values({ ...event, workspaceId: this.workspaceId, createdAt: event.createdAt ?? new Date() });
  }

  async originatorOf(entityType: ActivityEntityType, entityId: number) {
    const [row] = await this.db
      .select({ actorId: activityEvents.actorId })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.workspaceId, this.workspaceId),
          eq(activityEvents.entityType, entityType),
          eq(activityEvents.entityId, entityId),
          isNotNull(activityEvents.actorId),
        ),
      )
      .orderBy(asc(activityEvents.createdAt), asc(activityEvents.id))
      .limit(1);
    return row?.actorId ?? null;
  }
}
