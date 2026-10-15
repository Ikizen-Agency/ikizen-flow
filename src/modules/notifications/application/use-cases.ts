import type { Clock } from "../../shared-types";
import { notificationRecipients, safeNotificationHref, type NotificationType } from "../domain/notification";
import type { NotificationRepository } from "./ports";

export interface NotificationDeps {
  notifications: NotificationRepository;
  clock: Clock;
}

export interface NotifyInput {
  /** Candidate recipients (member ids). The actor and duplicates are removed; foreign members are dropped. */
  recipientIds: ReadonlyArray<number | null | undefined>;
  /** Member who caused the event; never notified about it. */
  actorId?: number | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
}

/** Signature other modules depend on (inject it as an optional `notify` dependency). */
export type Notify = (input: NotifyInput) => Promise<number>;

/** Emits one notification per recipient. Returns how many were created. */
export const makeNotify =
  ({ notifications, clock }: NotificationDeps) =>
  async ({ recipientIds, actorId, type, title, body, href }: NotifyInput): ReturnType<Notify> => {
    const candidates = notificationRecipients(recipientIds, actorId);
    if (candidates.length === 0) return 0;
    const recipients = await notifications.existingMemberIds(candidates);
    if (recipients.length === 0) return 0;
    const safeHref = safeNotificationHref(href);
    return notifications.createMany(
      recipients.map((recipientId) => ({ recipientId, type, title: title.trim().slice(0, 200), body: body?.trim() || null, href: safeHref })),
      clock(),
    );
  };

export const NOTIFICATIONS_PAGE_SIZE = 10;

export const makeListNotifications =
  ({ notifications }: Pick<NotificationDeps, "notifications">) =>
  (recipientId: number, { page = 1, pageSize = NOTIFICATIONS_PAGE_SIZE }: { page?: number; pageSize?: number } = {}) =>
    notifications.listForRecipient(recipientId, { page: Math.max(1, page), pageSize: Math.min(50, Math.max(1, pageSize)) });

export const makeCountUnreadNotifications =
  ({ notifications }: Pick<NotificationDeps, "notifications">) =>
  (recipientId: number) =>
    notifications.countUnread(recipientId);

/** Marks one of the recipient's notifications as read; null when it is not theirs. */
export const makeMarkNotificationRead =
  ({ notifications, clock }: NotificationDeps) =>
  (recipientId: number, id: number) =>
    notifications.markRead(recipientId, id, clock());

export const makeMarkAllNotificationsRead =
  ({ notifications, clock }: NotificationDeps) =>
  (recipientId: number) =>
    notifications.markAllRead(recipientId, clock());
