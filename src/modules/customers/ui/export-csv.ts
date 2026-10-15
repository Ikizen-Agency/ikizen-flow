import "server-only";
import type { WorkspaceApp } from "@/server/container";
import { toCsv } from "@/shared/domain/csv";
import { parseCustomerListParams, type SearchParamsRecord } from "../application/list-params";
import { CUSTOMER_STATUS_LABELS, CUSTOMER_TIER_LABELS } from "../domain/customer";

const EXPORT_LIMIT = 5_000;

/** Serialises the filtered directory (all pages) to CSV. */
export async function exportCustomersCsv(app: WorkspaceApp, params: SearchParamsRecord): Promise<string> {
  const query = { ...parseCustomerListParams(params), page: 1, pageSize: EXPORT_LIMIT };
  const { items } = await app.customers.list(query);
  return toCsv([
    ["Company", "Tier", "Status", "Industry", "Key Contact", "Email", "Last Activity", "Total Sales (USD)", "Outstanding (USD)"],
    ...items.map((c) => [
      c.company,
      CUSTOMER_TIER_LABELS[c.tier],
      CUSTOMER_STATUS_LABELS[c.status],
      c.industry,
      c.contactName,
      c.contactEmail,
      c.lastActivityAt?.toISOString() ?? "",
      (c.totalSalesCents / 100).toFixed(2),
      (c.outstandingCents / 100).toFixed(2),
    ]),
  ]);
}
