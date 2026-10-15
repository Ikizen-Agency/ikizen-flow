import type { ActivityRepository } from "./ports";

export const makeListRecentActivity =
  ({ activity }: { activity: ActivityRepository }) =>
  (limit = 10) =>
    activity.recent(limit);
