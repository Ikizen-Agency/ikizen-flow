import { NOTIFICATION_TYPES, type NotificationType } from "./notification";

/** How one member wants to receive one notification type. */
export interface NotificationPreference {
  type: NotificationType;
  inApp: boolean;
  email: boolean;
}

/** Applied when a member has not chosen yet: in-app on, email off. */
export const DEFAULT_DELIVERY = { inApp: true, email: false } as const;

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, { label: string; description: string }> = {
  task_assigned: { label: "Task assignments", description: "Someone assigns a task to you." },
  mention: { label: "Mentions", description: "Someone @mentions you in a task comment." },
  order_status: { label: "Order status changes", description: "An order you created changes status." },
  payment_received: { label: "Payments received", description: "A payment is recorded on an order you created." },
  payment_reminder: { label: "Payment reminders", description: "A payment reminder is sent for an order you created." },
  system: { label: "Workspace updates", description: "Announcements about your workspace." },
};

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

/** One entry per notification type (in the canonical order), stored choices over the defaults. */
export function resolvePreferences(stored: ReadonlyArray<NotificationPreference>): NotificationPreference[] {
  const byType = new Map(stored.map((p) => [p.type, p]));
  return NOTIFICATION_TYPES.map((type) => {
    const saved = byType.get(type);
    return { type, inApp: saved?.inApp ?? DEFAULT_DELIVERY.inApp, email: saved?.email ?? DEFAULT_DELIVERY.email };
  });
}
