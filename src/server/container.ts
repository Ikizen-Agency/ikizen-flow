import "server-only";
import { makeListRecentActivity } from "@/modules/activity/application/use-cases";
import { makeGetDashboard, makeSendPaymentReminder } from "@/modules/dashboard/application/use-cases";
import { DrizzleDashboardRepository } from "@/modules/dashboard/infrastructure/drizzle-dashboard-repository";
import { DrizzleActivityRepository } from "@/modules/activity/infrastructure/drizzle-activity-repository";
import {
  makeCreateCustomer,
  makeGetCustomerDirectoryStats,
  makeGetCustomerProfile,
  makeGetCustomerSummary,
  makeListCustomers,
} from "@/modules/customers/application/use-cases";
import { DrizzleCustomerRepository } from "@/modules/customers/infrastructure/drizzle-customer-repository";
import {
  makeChangeOrderStatus,
  makeCreateOrder,
  makeGetOrder,
  makeGetSalesOverview,
  makeListOrders,
} from "@/modules/sales/application/use-cases";
import { DrizzleOrderRepository } from "@/modules/sales/infrastructure/drizzle-order-repository";
import { systemClock } from "@/modules/shared-types";
import {
  makeAddSubtask,
  makeCommentOnTask,
  makeCreateTask,
  makeGetTaskBoard,
  makeGetTaskDetail,
  makeMoveTask,
  makeToggleSubtask,
} from "@/modules/tasks/application/use-cases";
import { DrizzleTaskRepository } from "@/modules/tasks/infrastructure/drizzle-task-repository";
import { DrizzleMemberRepository } from "@/modules/team/infrastructure/drizzle-member-repository";
import { makeListMyWorkspaces } from "@/modules/workspaces/application/use-cases";
import { DrizzleWorkspaceDirectory } from "@/modules/workspaces/infrastructure/drizzle-workspace-directory";
import { db } from "./db/client";

const clock = systemClock;
const workspaceDirectory = new DrizzleWorkspaceDirectory(db);

/**
 * Composition root: the only place that knows which adapters implement each port.
 *
 * Business data is tenant-scoped, so there is no global container for it: `forWorkspace(id)` wires
 * repositories bound to one workspace. Application code never calls it with an id it picked itself;
 * it goes through `getWorkspaceApp()` / `requireRequestContext()` in `@/server/request-context`,
 * which resolve the workspace from the signed-in session.
 */
export function forWorkspace(workspaceId: number) {
  const repositories = {
    customers: new DrizzleCustomerRepository(db, workspaceId),
    orders: new DrizzleOrderRepository(db, workspaceId),
    tasks: new DrizzleTaskRepository(db, workspaceId),
    activity: new DrizzleActivityRepository(db, workspaceId),
    members: new DrizzleMemberRepository(db, workspaceId),
    dashboard: new DrizzleDashboardRepository(db, workspaceId),
  };
  const deps = { ...repositories, clock };

  return {
    workspaceId,
    repositories,
    clock,
    customers: {
      list: makeListCustomers(deps),
      create: makeCreateCustomer(deps),
      summary: makeGetCustomerSummary(deps),
      stats: makeGetCustomerDirectoryStats(deps),
      profile: makeGetCustomerProfile(deps),
    },
    sales: {
      list: makeListOrders(deps),
      create: makeCreateOrder(deps),
      changeStatus: makeChangeOrderStatus(deps),
      get: makeGetOrder(deps),
      overview: makeGetSalesOverview(deps),
    },
    tasks: {
      board: makeGetTaskBoard(deps),
      create: makeCreateTask(deps),
      move: makeMoveTask(deps),
      detail: makeGetTaskDetail(deps),
      toggleSubtask: makeToggleSubtask(deps),
      addSubtask: makeAddSubtask(deps),
      comment: makeCommentOnTask(deps),
    },
    team: {
      members: () => repositories.members.list(),
    },
    activity: {
      recent: makeListRecentActivity(deps),
    },
    dashboard: {
      overview: makeGetDashboard(deps),
      sendReminder: makeSendPaymentReminder(deps),
    },
  } as const;
}

export type WorkspaceApp = ReturnType<typeof forWorkspace>;

/** Cross-workspace services (the tenant directory). */
export const directory = {
  clock,
  listMyWorkspaces: makeListMyWorkspaces({ workspaces: workspaceDirectory }),
} as const;
