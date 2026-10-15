import type { ActivityFeedQuery, ActivityRepository } from "./ports";

export const makeListRecentActivity =
  ({ activity }: { activity: ActivityRepository }) =>
  (limit = 10) =>
    activity.recent(limit);

export const ACTIVITY_PAGE_SIZE = 20;

/** Full activity feed of the workspace for /activity (page size capped at 100). */
export const makeListActivity =
  ({ activity }: { activity: ActivityRepository }) =>
  ({ page = 1, pageSize = ACTIVITY_PAGE_SIZE, ...filters }: ActivityFeedQuery = {}) =>
    activity.list({ ...filters, page: Math.max(1, page), pageSize: Math.min(100, Math.max(1, pageSize)) });
