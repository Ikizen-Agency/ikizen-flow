import type { Page, PageRequest } from "../../shared-types";
import type { ActivityCategory, ActivityEntityType, ActivityEvent, ActivityFeedItem, NewActivityEvent } from "../domain/activity";

export interface ActivityFeedQuery extends PageRequest {
  category?: ActivityCategory;
  /** Member who performed the action. */
  actorId?: number;
  entityType?: ActivityEntityType;
}

export interface ActivityRepository {
  recent(limit: number): Promise<ActivityEvent[]>;
  /** Filtered, paginated feed (newest first) with links to the records. */
  list(query: ActivityFeedQuery): Promise<Page<ActivityFeedItem>>;
  /** Newest first, for one entity's timeline. */
  forEntity(entityType: ActivityEntityType, entityId: number, limit: number): Promise<ActivityEvent[]>;
  record(event: NewActivityEvent): Promise<void>;
  /** Actor of the earliest event of an entity (who created it), when known. */
  originatorOf(entityType: ActivityEntityType, entityId: number): Promise<number | null>;
}
