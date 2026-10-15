import type { Page, PageRequest } from "../../shared-types";
import type { NewNotification, Notification } from "../domain/notification";

/** Notifications of one workspace (the adapter is constructed for a workspace). */
export interface NotificationRepository {
  createMany(notifications: NewNotification[], now: Date): Promise<number>;
  /** Unread first, then newest first. */
  listForRecipient(recipientId: number, page: Required<PageRequest>): Promise<Page<Notification>>;
  countUnread(recipientId: number): Promise<number>;
  /** Returns the notification when it belongs to the recipient (marking it read if it was unread). */
  markRead(recipientId: number, id: number, at: Date): Promise<Notification | null>;
  markAllRead(recipientId: number, at: Date): Promise<number>;
  /** Members of this workspace that exist (recipients from other workspaces are dropped). */
  existingMemberIds(ids: number[]): Promise<number[]>;
}
