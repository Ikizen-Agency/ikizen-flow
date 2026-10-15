import type { NewOutboxEmail } from "../../mail/application/ports";
import type { OutboxEmail } from "../../mail/domain/email";
import type { Clock } from "../../shared-types";
import { notificationRecipients, safeNotificationHref, type NotificationType } from "../domain/notification";
import { isNotificationType, resolvePreferences, type NotificationPreference } from "../domain/preferences";
import type { NotificationPreferenceRepository, NotificationRepository, RecipientDelivery } from "./ports";

export interface NotificationDeps {
  notifications: NotificationRepository;
  clock: Clock;
}

/** Optional delivery preferences: without them every recipient gets the in-app notification and no email. */
export interface NotifyDeliveryDeps {
  preferences?: NotificationPreferenceRepository;
  sendEmail?: (email: NewOutboxEmail) => Promise<OutboxEmail>;
  /** Public origin of the app, to turn `href` into an absolute link in emails. */
  baseUrl?: string;
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

/**
 * Emits one in-app notification per recipient who has that type enabled in-app (default on), and emails
 * those who enabled email for it (default off) through the outbox. Email problems are logged and never
 * break the caller. Returns how many in-app notifications were created.
 */
export const makeNotify =
  ({ notifications, clock, preferences, sendEmail, baseUrl }: NotificationDeps & NotifyDeliveryDeps) =>
  async ({ recipientIds, actorId, type, title, body, href }: NotifyInput): ReturnType<Notify> => {
    const candidates = notificationRecipients(recipientIds, actorId);
    if (candidates.length === 0) return 0;
    const deliveries: RecipientDelivery[] = preferences
      ? await preferences.deliveryFor(candidates, type)
      : (await notifications.existingMemberIds(candidates)).map((memberId) => ({ memberId, email: "", inApp: true, sendEmail: false }));
    const safeHref = safeNotificationHref(href);
    const cleanTitle = title.trim().slice(0, 200);
    const cleanBody = body?.trim() || null;

    const inApp = deliveries.filter((d) => d.inApp);
    const created = inApp.length
      ? await notifications.createMany(
          inApp.map(({ memberId }) => ({ recipientId: memberId, type, title: cleanTitle, body: cleanBody, href: safeHref })),
          clock(),
        )
      : 0;

    if (sendEmail) {
      const link = safeHref && baseUrl ? `${baseUrl.replace(/\/+$/, "")}${safeHref}` : null;
      const text = [cleanTitle, cleanBody, link ? `Open in Ikizen Flow: ${link}` : null, "", "You receive this email because of your notification settings in Ikizen Flow."]
        .filter((line) => line !== null)
        .join("\n");
      for (const d of deliveries.filter((x) => x.sendEmail && x.email)) {
        try {
          await sendEmail({ to: d.email, subject: cleanTitle.replace(/[\r\n]+/g, " "), text, kind: "notification", createdById: actorId ?? null });
        } catch (error) {
          console.error("Notification email could not be queued", error);
        }
      }
    }
    return created;
  };

/** Every notification type with the member's choice (defaults for types never saved). */
export const makeGetNotificationPreferences =
  ({ preferences }: { preferences: NotificationPreferenceRepository }) =>
  async (memberId: number) =>
    resolvePreferences(await preferences.forMember(memberId));

/** Saves the member's own choices; unknown types are ignored. */
export const makeSaveNotificationPreferences =
  ({ preferences }: { preferences: NotificationPreferenceRepository }) =>
  async (memberId: number, choices: ReadonlyArray<NotificationPreference>) => {
    const valid = choices.filter((c) => isNotificationType(c.type)).map((c) => ({ type: c.type, inApp: Boolean(c.inApp), email: Boolean(c.email) }));
    await preferences.save(memberId, valid);
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
