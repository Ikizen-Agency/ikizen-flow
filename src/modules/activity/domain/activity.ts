export const ACTIVITY_CATEGORIES = ["billing", "pipeline", "strategy", "development", "operations"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  billing: "Billing",
  pipeline: "Pipeline",
  strategy: "Strategy",
  development: "Development",
  operations: "Operations",
};

export const ACTIVITY_ENTITY_TYPES = ["customer", "order", "task"] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export const ACTIVITY_ENTITY_LABELS: Record<ActivityEntityType, string> = { customer: "Customers", order: "Orders & invoices", task: "Tasks" };

/** In-app link to the record an event is about (orders need their reference). */
export function activityHref(entityType: ActivityEntityType | null, entityId: number | null, orderReference: string | null): string | null {
  if (entityType === "task" && entityId) return `/tasks?task=${entityId}`;
  if (entityType === "customer" && entityId) return `/customers?customer=${entityId}`;
  if (entityType === "order" && orderReference) return `/sales?order=${encodeURIComponent(orderReference)}`;
  return null;
}

export interface ActivityEvent {
  id: number;
  actorName: string | null;
  /** Predicate rendered after the actor: "marked Invoice #INV-2041 as Paid". */
  message: string;
  category: ActivityCategory;
  entityType: ActivityEntityType | null;
  entityId: number | null;
  createdAt: Date;
}

/** Feed row of the /activity page: the event plus a link to its record when it still exists. */
export interface ActivityFeedItem extends ActivityEvent {
  href: string | null;
}

export interface NewActivityEvent {
  actorId: number | null;
  message: string;
  category: ActivityCategory;
  entityType?: ActivityEntityType | null;
  entityId?: number | null;
  createdAt?: Date;
}
