import type { ActivityEntityType, ActivityEvent, NewActivityEvent } from "../domain/activity";

export interface ActivityRepository {
  recent(limit: number): Promise<ActivityEvent[]>;
  /** Newest first, for one entity's timeline. */
  forEntity(entityType: ActivityEntityType, entityId: number, limit: number): Promise<ActivityEvent[]>;
  record(event: NewActivityEvent): Promise<void>;
}
