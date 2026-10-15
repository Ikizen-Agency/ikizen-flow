import type { Page, PageRequest } from "../../shared-types";
import type { OrderSummary } from "../domain/metrics";
import type { EffectiveOrderStatus, OrderCategory, OrderStatus, PaymentTerms } from "../domain/order";
import type { PaymentMethod } from "../domain/payment";

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
  /** Sum of recorded payments; the balance is `amountCents - paidCents`. */
  paidCents: number;
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

/** Rewrite of an editable order (draft / pending) from the sale composer. */
export interface OrderUpdate {
  customerId: number;
  title: string;
  description: string | null;
  category: OrderCategory;
  paymentTerms: PaymentTerms;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  amountCents: number;
  dueDate: Date;
  items: NewOrderItem[];
  updatedAt: Date;
}

export interface Payment {
  id: number;
  orderId: number;
  amountCents: number;
  method: PaymentMethod;
  paidAt: Date;
  reference: string | null;
  note: string | null;
  recordedById: number | null;
  recordedByName: string | null;
  createdAt: Date;
}

export interface NewPayment {
  orderId: number;
  amountCents: number;
  method: PaymentMethod;
  paidAt: Date;
  reference?: string | null;
  note?: string | null;
  recordedById: number | null;
}

/** Payments of one workspace (orders of other workspaces are unreachable). */
export interface PaymentRepository {
  /** Newest first. */
  listForOrder(orderId: number): Promise<Payment[]>;
  findById(id: number): Promise<Payment | null>;
  /** Throws `NotFoundError` when the order is not in this workspace. */
  create(payment: NewPayment, now: Date): Promise<Payment>;
  /** Returns false when the payment does not exist in this workspace. */
  delete(id: number): Promise<boolean>;
}

export interface OrderRepository {
  list(query: OrderListQuery): Promise<Page<Order>>;
  findByReference(reference: string): Promise<OrderWithItems | null>;
  findById(id: number): Promise<Order | null>;
  countByStatus(): Promise<Record<OrderStatus, number>>;
  /** Every order as a lightweight projection, for KPI aggregation. */
  listSummaries(): Promise<OrderSummary[]>;
  latestReference(): Promise<string | null>;
  create(order: NewOrder, now: Date): Promise<Order>;
  updateStatus(id: number, change: OrderStatusChange): Promise<void>;
  /** Replaces the order's fields and line items (customer must belong to the workspace). */
  update(id: number, update: OrderUpdate): Promise<void>;
  /** Hard delete (line items and payments cascade). */
  delete(id: number): Promise<void>;
}
