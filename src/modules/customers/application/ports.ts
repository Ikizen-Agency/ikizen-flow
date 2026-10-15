import type { Page, PageRequest } from "../../shared-types";
import type { CustomerStatus, CustomerTier } from "../domain/customer";
import type { PaymentTerms } from "../../sales/domain/order";

export interface Customer {
  id: number;
  company: string;
  tier: CustomerTier;
  status: CustomerStatus;
  industry: string;
  contactName: string;
  contactEmail: string;
  billingEmail: string | null;
  paymentTerms: PaymentTerms;
  lastActivityAt: Date | null;
  createdAt: Date;
}

/** Directory row: customer plus aggregates computed from orders. */
export interface CustomerListItem extends Customer {
  /** Sum of non-draft, non-cancelled orders. */
  totalSalesCents: number;
  /** Amount in open orders (pending/processing/invoiced). */
  outstandingCents: number;
}

export type CustomerSort = "last_active" | "sales_desc" | "sales_asc" | "company";

export interface CustomerListQuery extends PageRequest {
  search?: string;
  status?: CustomerStatus;
  tier?: CustomerTier;
  sort?: CustomerSort;
}

export interface NewCustomer {
  company: string;
  tier: CustomerTier;
  status: CustomerStatus;
  industry: string;
  contactName: string;
  contactEmail: string;
  billingEmail?: string | null;
  paymentTerms?: PaymentTerms;
}

export interface CustomerRepository {
  list(query: CustomerListQuery): Promise<Page<CustomerListItem>>;
  findById(id: number): Promise<Customer | null>;
  /** Single directory row (customer + order aggregates). */
  findSummaryById(id: number): Promise<CustomerListItem | null>;
  /** Case-insensitive lookup used to keep company names unique. */
  findByCompany(company: string): Promise<Customer | null>;
  countCreatedSince(since: Date): Promise<number>;
  /** Lightweight options for selects (e.g. "Client Account" on the sale form). */
  listOptions(): Promise<Array<Pick<Customer, "id" | "company" | "contactEmail">>>;
  countByStatus(): Promise<Record<CustomerStatus, number>>;
  create(input: NewCustomer, now: Date): Promise<Customer>;
  touch(id: number, at: Date): Promise<void>;
}
