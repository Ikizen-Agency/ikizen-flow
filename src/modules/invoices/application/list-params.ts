import { parseIsoDate } from "@/shared/domain/time";
import { firstParam, parsePage, type SearchParamsRecord } from "../../customers/application/list-params";
import { INVOICE_TABS, type InvoiceTab } from "../domain/invoice";

export const INVOICE_PAGE_SIZE = 10;
const LAST_MS_OF_DAY = 24 * 60 * 60 * 1000 - 1;

export interface InvoiceListQuery {
  tab: InvoiceTab;
  search?: string;
  customerId?: number;
  /** Issue date range, both inclusive. */
  issuedFrom?: Date;
  issuedTo?: Date;
  page: number;
  pageSize: number;
}

function positiveInt(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** Translates untrusted URL params (`status`, `q`, `customerId`, `from`, `to`, `page`) into an invoice list query. */
export function parseInvoiceListParams(params: SearchParamsRecord, pageSize = INVOICE_PAGE_SIZE): InvoiceListQuery {
  const tab = firstParam(params.status) as InvoiceTab | undefined;
  const search = firstParam(params.q)?.trim();
  const from = parseIsoDate(firstParam(params.from));
  const to = parseIsoDate(firstParam(params.to));
  const query: InvoiceListQuery = { tab: tab && INVOICE_TABS.includes(tab) ? tab : "all", page: parsePage(firstParam(params.page)), pageSize };
  if (search) query.search = search;
  const customerId = positiveInt(firstParam(params.customerId));
  if (customerId) query.customerId = customerId;
  if (from) query.issuedFrom = from;
  if (to) query.issuedTo = new Date(to.getTime() + LAST_MS_OF_DAY);
  return query;
}

/** The query as URL params (for links that keep the current filters). */
export function invoiceListUrlParams(query: InvoiceListQuery) {
  return {
    status: query.tab === "all" ? undefined : query.tab,
    q: query.search,
    customerId: query.customerId,
    from: query.issuedFrom?.toISOString().slice(0, 10),
    to: query.issuedTo?.toISOString().slice(0, 10),
  };
}
