import type { ActivityEvent, NewActivityEvent } from "../domain/activity";

export interface ActivityRepository {
  recent(limit: number): Promise<ActivityEvent[]>;
  record(event: NewActivityEvent): Promise<void>;
}
