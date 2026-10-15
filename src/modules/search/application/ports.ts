import type { CustomerHit, OrderHit, TaskHit } from "../domain/search";

/** Global search over one workspace (the adapter is constructed for a workspace). */
export interface SearchRepository {
  customers(pattern: string, limit: number): Promise<CustomerHit[]>;
  orders(pattern: string, limit: number): Promise<OrderHit[]>;
  tasks(pattern: string, limit: number): Promise<TaskHit[]>;
}
