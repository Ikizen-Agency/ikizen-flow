export const CUSTOMER_TIERS = ["enterprise", "retainer", "project"] as const;
export type CustomerTier = (typeof CUSTOMER_TIERS)[number];

export const CUSTOMER_TIER_LABELS: Record<CustomerTier, string> = {
  enterprise: "Enterprise",
  retainer: "Retainer",
  project: "Project",
};

export const CUSTOMER_STATUSES = ["active", "pending_review", "inactive", "archived"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

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
