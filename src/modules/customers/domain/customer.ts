export const CUSTOMER_TIERS = ["enterprise", "retainer", "project"] as const;
export type CustomerTier = (typeof CUSTOMER_TIERS)[number];

export const CUSTOMER_TIER_LABELS: Record<CustomerTier, string> = {
  enterprise: "Enterprise",
  retainer: "Retainer",
  project: "Project",
};

export const CUSTOMER_STATUSES = ["active", "pending_review", "inactive", "archived"] as const;
/** Display status. "archived" is derived from `archivedAt`; the others are stored. */
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

/** Lifecycle statuses that can be stored and assigned directly (archiving is a separate, reversible flag). */
export const ASSIGNABLE_CUSTOMER_STATUSES = ["active", "pending_review", "inactive"] as const;
export type AssignableCustomerStatus = (typeof ASSIGNABLE_CUSTOMER_STATUSES)[number];

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active: "Active",
  pending_review: "Pending Review",
  inactive: "Inactive",
  archived: "Archived",
};

export type StatusTone = "success" | "warning" | "neutral";

export function customerStatusTone(status: CustomerStatus): StatusTone {
  if (status === "active") return "success";
  if (status === "pending_review") return "warning";
  return "neutral";
}

/** Accounts that count towards the active client base. */
export function isEngaged(status: CustomerStatus): boolean {
  return status === "active" || status === "pending_review";
}

const STOP_WORDS = new Set(["the", "a", "an"]);

export function companyInitials(company: string): string {
  const words = company
    .trim()
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Share of non-archived accounts that are still engaged (the "Client Health" retention KPI). */
export function retentionRate(counts: Record<CustomerStatus, number>): number {
  const tracked = counts.active + counts.pending_review + counts.inactive;
  return tracked === 0 ? 0 : (counts.active + counts.pending_review) / tracked;
}

const STATUS_PENALTY: Record<CustomerStatus, number> = { active: 0, pending_review: 13, inactive: 40, archived: 60 };
const STALE_GRACE_DAYS = 7;
const MAX_STALE_PENALTY = 30;
const OVERDUE_PENALTY = 16;

export interface HealthInputs {
  status: CustomerStatus;
  /** Whole days since the last recorded activity; null when there was never any. */
  daysSinceActivity: number | null;
  overdueOrders: number;
}

/** 0-100 account health: penalises disengaged status, inactivity beyond a week and overdue receivables. */
export function customerHealthScore({ status, daysSinceActivity, overdueOrders }: HealthInputs): number {
  const stale =
    daysSinceActivity === null ? MAX_STALE_PENALTY : Math.min(MAX_STALE_PENALTY, Math.max(0, daysSinceActivity - STALE_GRACE_DAYS));
  const score = 100 - STATUS_PENALTY[status] - stale - overdueOrders * OVERDUE_PENALTY;
  return Math.max(0, Math.min(100, score));
}

/** Archived accounts keep their lifecycle status underneath, so unarchiving restores it. */
export function effectiveCustomerStatus({ status, archivedAt }: { status: AssignableCustomerStatus; archivedAt: Date | null }): CustomerStatus {
  return archivedAt ? "archived" : status;
}

export interface CustomerDependencies {
  orders: number;
  tasks: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export class CustomerHasDependenciesError extends Error {
  constructor(
    readonly company: string,
    readonly dependencies: CustomerDependencies,
  ) {
    const parts = [
      dependencies.orders ? plural(dependencies.orders, "order") : null,
      dependencies.tasks ? plural(dependencies.tasks, "task") : null,
    ].filter(Boolean);
    super(`${company} has ${parts.join(" and ")} and cannot be deleted. Archive it instead to keep its history.`);
    this.name = "CustomerHasDependenciesError";
  }
}

/** Hard deletion is only allowed for accounts without orders or tasks; the rest must be archived. */
export function assertCustomerDeletable(company: string, dependencies: CustomerDependencies): void {
  if (dependencies.orders > 0 || dependencies.tasks > 0) throw new CustomerHasDependenciesError(company, dependencies);
}
