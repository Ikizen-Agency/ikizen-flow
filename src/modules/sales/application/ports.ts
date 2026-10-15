import type { Page, PageRequest } from "../../shared-types";
import type { OrderSummary } from "../domain/metrics";
import type { EffectiveOrderStatus, OrderCategory, OrderStatus, PaymentTerms } from "../domain/order";

export interface OrderItem {
  id: number;
  position: number;
  title: string;
  description: string | null;
  quantity: number;
  unit: "unit" | "hours";
  unitRateCents: number;
  taxRateBps: number;
}

export interface Order {
  id: number;
  reference: string;
  customerId: number;
  customerCompany: string;
  title: string;
  description: string | null;
  category: OrderCategory;
  status: OrderStatus;
  paymentTerms: PaymentTerms;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  amountCents: number;
  invoiceNumber: string | null;
  issueDate: Date;
  dueDate: Date;
  paidAt: Date | null;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface OrderListQuery extends PageRequest {
  /** Display status; "overdue" and open statuses are resolved against `asOf`. */
  status?: EffectiveOrderStatus;
  /** Reference instant for overdue derivation (defaults to now). */
  asOf?: Date;
  customerId?: number;
  search?: string;
  issuedFrom?: Date;
  issuedTo?: Date;
}

export interface NewOrderItem {
  title: string;
  description?: string | null;
  quantity: number;
  unit?: "unit" | "hours";
  unitRateCents: number;
  taxRateBps?: number;
}

export interface NewOrder {
  reference: string;
  customerId: number;
  title: string;
  description?: string | null;
  category: OrderCategory;
  status: OrderStatus;
  paymentTerms: PaymentTerms;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  amountCents: number;
  invoiceNumber?: string | null;
  issueDate: Date;
  dueDate: Date;
  items: NewOrderItem[];
}

export interface OrderStatusChange {
  status: OrderStatus;
  invoiceNumber?: string | null;
  paidAt?: Date | null;
  updatedAt: Date;
}

export interface OrderRepository {
  list(query: OrderListQuery): Promise<Page<Order>>;
  findByReference(reference: string): Promise<OrderWithItems | null>;
  countByStatus(): Promise<Record<OrderStatus, number>>;
  /** Every order as a lightweight projection, for KPI aggregation. */
  listSummaries(): Promise<OrderSummary[]>;
  latestReference(): Promise<string | null>;
  create(order: NewOrder, now: Date): Promise<Order>;
  updateStatus(id: number, change: OrderStatusChange): Promise<void>;
}
