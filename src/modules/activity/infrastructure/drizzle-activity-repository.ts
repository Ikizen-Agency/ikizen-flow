import "server-only";
import { desc, eq } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { activityEvents, members } from "@/server/db/schema";
import type { NewActivityEvent } from "../domain/activity";
import type { ActivityRepository } from "../application/ports";

export class DrizzleActivityRepository implements ActivityRepository {
  constructor(private readonly db: Database) {}

  recent(limit: number) {
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
      .leftJoin(members, eq(members.id, activityEvents.actorId))
      .orderBy(desc(activityEvents.createdAt), desc(activityEvents.id))
      .limit(limit);
  }

  async record(event: NewActivityEvent) {
    await this.db.insert(activityEvents).values({ ...event, createdAt: event.createdAt ?? new Date() });
  }
}
