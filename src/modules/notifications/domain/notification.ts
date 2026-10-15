import { hasControlOrWhitespace } from "@/shared/domain/control-characters";
export const NOTIFICATION_TYPES = ["task_assigned", "order_status", "payment_reminder", "payment_received", "mention", "system"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  task_assigned: "assignment_ind",
  order_status: "receipt_long",
  payment_reminder: "notifications_active",
  payment_received: "payments",
  mention: "alternate_email",
  system: "info",
};

export interface Notification {
  id: number;
  recipientId: number;
  type: NotificationType;
  title: string;
  body: string | null;
  /** In-app destination (always a relative path). */
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface NewNotification {
  recipientId: number;
  type: NotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
}

/** Only same-origin relative paths are stored as notification targets. */
export function safeNotificationHref(href: string | null | undefined): string | null {
  if (!href) return null;
  return href.startsWith("/") && !href.startsWith("//") && !href.includes("\\") && !hasControlOrWhitespace(href) ? href : null;
}

/**
 * Who should receive a notification: distinct recipients, never the actor who caused it
 * (nobody is notified about their own actions).
 */
export function notificationRecipients(candidates: ReadonlyArray<number | null | undefined>, actorId: number | null | undefined): number[] {
  const out: number[] = [];
  for (const id of candidates) {
    if (id == null || id === actorId || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}
