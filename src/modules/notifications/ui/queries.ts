import "server-only";
import type { WorkspaceApp } from "@/server/container";
import { toNotificationView, type NotificationPageView } from "./view";

/** One page of a member's notifications (unread first) plus the unread count, ready for the client. */
export async function loadNotificationPage(app: WorkspaceApp, memberId: number, page = 1): Promise<NotificationPageView> {
  const [list, unread] = await Promise.all([app.notifications.list(memberId, { page }), app.notifications.unreadCount(memberId)]);
  const now = app.clock();
  return {
    items: list.items.map((n) => toNotificationView(n, now)),
    unread,
    total: list.total,
    page: list.page,
    hasMore: list.page * list.pageSize < list.total,
  };
}
