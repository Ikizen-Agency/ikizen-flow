import type { Page, PageRequest } from "../../shared-types";
import type { AssignableCustomerStatus, CustomerDependencies, CustomerStatus, CustomerTier } from "../domain/customer";
import type { PaymentTerms } from "../../sales/domain/order";

export interface Customer {
  id: number;
  company: string;
  tier: CustomerTier;
  /** Display status ("archived" when `archivedAt` is set). */
  status: CustomerStatus;
  /** Stored lifecycle status, kept while archived and restored on unarchive. */
  baseStatus: AssignableCustomerStatus;
  industry: string;
  contactName: string;
  contactEmail: string;
  billingEmail: string | null;
  paymentTerms: PaymentTerms;
  lastActivityAt: Date | null;
  archivedAt: Date | null;
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
  status: AssignableCustomerStatus;
  industry: string;
  contactName: string;
  contactEmail: string;
  billingEmail?: string | null;
  paymentTerms?: PaymentTerms;
}

/** Editable fields of a customer (every field from the create form). */
export type CustomerPatch = Partial<Omit<NewCustomer, "billingEmail">> & { billingEmail?: string | null };

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
  /** Customers of this workspace among `ids` (ids of other workspaces are ignored). */
  findManyByIds(ids: ReadonlyArray<number>): Promise<Customer[]>;
  update(id: number, patch: CustomerPatch, now: Date): Promise<Customer | null>;
  /** Sets or clears `archivedAt` on the workspace's customers among `ids`; returns the ids changed. */
  setArchived(ids: ReadonlyArray<number>, archivedAt: Date | null, now: Date): Promise<number[]>;
  setTier(ids: ReadonlyArray<number>, tier: CustomerTier, now: Date): Promise<number[]>;
  /** Orders and tasks referencing each of the workspace's customers among `ids`. */
  dependencies(ids: ReadonlyArray<number>): Promise<Map<number, CustomerDependencies>>;
  /** Atomic hard delete of the workspace's customers among `ids` that have no orders or tasks; returns the ids deleted. */
  deleteMany(ids: ReadonlyArray<number>): Promise<number[]>;
}
