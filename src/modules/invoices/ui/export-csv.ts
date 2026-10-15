import "server-only";
import type { WorkspaceApp } from "@/server/container";
import { toCsv } from "@/shared/domain/csv";
import type { SearchParamsRecord } from "../../customers/application/list-params";
import { parseInvoiceListParams } from "../application/list-params";
import { invoiceCsvRows } from "../domain/invoice";

const EXPORT_LIMIT = 5_000;

/** Serialises the filtered invoice list (all pages) to CSV, formula-injection safe. */
export async function exportInvoicesCsv(app: WorkspaceApp, params: SearchParamsRecord): Promise<string> {
  const { items } = await app.invoices.list({ ...parseInvoiceListParams(params), page: 1, pageSize: EXPORT_LIMIT });
  return toCsv(invoiceCsvRows(items, app.clock()));
}
