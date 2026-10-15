import type { Page, PageRequest } from "../../shared-types";
import type { NewNotification, Notification, NotificationType } from "../domain/notification";
import type { NotificationPreference } from "../domain/preferences";

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

/** A recipient's delivery choice for one type, with the address to email. */
export interface RecipientDelivery {
  memberId: number;
  email: string;
  inApp: boolean;
  sendEmail: boolean;
}

/** Notification preferences of one workspace's members. */
export interface NotificationPreferenceRepository {
  /** Stored choices only (types without a row use the defaults). */
  forMember(memberId: number): Promise<NotificationPreference[]>;
  /** Upserts the given types for the member. */
  save(memberId: number, preferences: ReadonlyArray<NotificationPreference>): Promise<void>;
  /** Active members of this workspace among `memberIds` (input order) with their choice for `type`. */
  deliveryFor(memberIds: number[], type: NotificationType): Promise<RecipientDelivery[]>;
}
