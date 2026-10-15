import { formatRelativeTime } from "@/shared/domain/time";
import type { Notification } from "../domain/notification";

export interface NotificationView {
  id: number;
  type: Notification["type"];
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  /** "18 minutes ago", computed on the server. */
  relative: string;
}

export interface NotificationPageView {
  items: NotificationView[];
  unread: number;
  total: number;
  page: number;
  hasMore: boolean;
}

export const toNotificationView = (n: Notification, now: Date): NotificationView => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  href: n.href,
  read: n.readAt !== null,
  relative: formatRelativeTime(n.createdAt, now),
});
