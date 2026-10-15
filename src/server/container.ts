import "server-only";
import { makeListRecentActivity } from "@/modules/activity/application/use-cases";
import { DrizzleActivityRepository } from "@/modules/activity/infrastructure/drizzle-activity-repository";
import { makeCreateCustomer, makeListCustomers } from "@/modules/customers/application/use-cases";
import { DrizzleCustomerRepository } from "@/modules/customers/infrastructure/drizzle-customer-repository";
import { makeChangeOrderStatus, makeCreateOrder, makeListOrders } from "@/modules/sales/application/use-cases";
import { DrizzleOrderRepository } from "@/modules/sales/infrastructure/drizzle-order-repository";
import { systemClock } from "@/modules/shared-types";
import { makeCreateTask, makeGetTaskBoard, makeMoveTask } from "@/modules/tasks/application/use-cases";
import { DrizzleTaskRepository } from "@/modules/tasks/infrastructure/drizzle-task-repository";
import { DrizzleMemberRepository } from "@/modules/team/infrastructure/drizzle-member-repository";
import { db } from "./db/client";

/**
 * Composition root: the only place that knows which adapters implement each port.
 * Server Components, Server Actions and Route Handlers import use cases from here.
 */
const repositories = {
  customers: new DrizzleCustomerRepository(db),
  orders: new DrizzleOrderRepository(db),
  tasks: new DrizzleTaskRepository(db),
  activity: new DrizzleActivityRepository(db),
  members: new DrizzleMemberRepository(db),
};

const clock = systemClock;
const deps = { ...repositories, clock };

export const container = {
  repositories,
  clock,
  customers: {
    list: makeListCustomers(deps),
    create: makeCreateCustomer(deps),
  },
  sales: {
    list: makeListOrders(deps),
    create: makeCreateOrder(deps),
    changeStatus: makeChangeOrderStatus(deps),
  },
  tasks: {
    board: makeGetTaskBoard(deps),
    create: makeCreateTask(deps),
    move: makeMoveTask(deps),
  },
  activity: {
    recent: makeListRecentActivity(deps),
  },
} as const;
