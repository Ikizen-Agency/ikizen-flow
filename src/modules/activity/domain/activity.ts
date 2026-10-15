export const ACTIVITY_CATEGORIES = ["billing", "pipeline", "strategy", "development", "operations"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  billing: "Billing",
  pipeline: "Pipeline",
  strategy: "Strategy",
  development: "Development",
  operations: "Operations",
};

export type ActivityEntityType = "customer" | "order" | "task";

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

export interface NewActivityEvent {
  actorId: number | null;
  message: string;
  category: ActivityCategory;
  entityType?: ActivityEntityType | null;
  entityId?: number | null;
  createdAt?: Date;
}
