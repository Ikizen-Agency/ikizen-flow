import type { OrderFact } from "../domain/dashboard";

/** Read-side queries that only the dashboard needs. */
export interface DashboardRepository {
  /** Every order as a lightweight fact row (category included) for revenue aggregation. */
  orderFacts(): Promise<OrderFact[]>;
}
