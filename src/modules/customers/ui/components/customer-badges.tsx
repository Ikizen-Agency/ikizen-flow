import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/badge";
import {
  companyInitials,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TIER_LABELS,
  customerStatusTone,
  isEngaged,
  type CustomerStatus,
  type CustomerTier,
} from "../../domain/customer";

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <Badge tone={customerStatusTone(status)} dot className="rounded-full">
      {CUSTOMER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function TierTag({ tier, suffix = "" }: { tier: CustomerTier; suffix?: string }) {
  return (
    <span className="inline-block rounded-sm bg-surface-container px-2 py-0.5 text-label-sm text-ink">
      {CUSTOMER_TIER_LABELS[tier]}
      {suffix}
    </span>
  );
}

const tierTiles: Record<CustomerTier, string> = {
  enterprise: "bg-primary-fixed text-on-primary-fixed-variant",
  retainer: "bg-secondary-fixed text-on-secondary-fixed-variant",
  project: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
};

/** Rounded-square company monogram, tinted by tier and greyed out for disengaged accounts. */
export function CompanyTile({
  company,
  tier,
  status,
  size = "md",
}: {
  company: string;
  tier: CustomerTier;
  status: CustomerStatus;
  size?: "md" | "lg";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-control font-semibold",
        size === "md" ? "size-10 text-label-md" : "size-12 text-headline-md",
        isEngaged(status) ? tierTiles[tier] : "bg-surface-container text-outline",
      )}
    >
      {companyInitials(company)}
    </span>
  );
}
