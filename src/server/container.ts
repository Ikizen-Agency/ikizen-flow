import "server-only";
import { makeListRecentActivity } from "@/modules/activity/application/use-cases";
import { makeGetDashboard, makeSendPaymentReminder } from "@/modules/dashboard/application/use-cases";
import { DrizzleDashboardRepository } from "@/modules/dashboard/infrastructure/drizzle-dashboard-repository";
import { DrizzleActivityRepository } from "@/modules/activity/infrastructure/drizzle-activity-repository";
import {
  makeApplyCustomerTier,
  makeArchiveCustomers,
  makeCreateCustomer,
  makeDeleteCustomer,
  makeDeleteCustomers,
  makeGetCustomerDirectoryStats,
  makeGetCustomerProfile,
  makeGetCustomerSummary,
  makeListCustomers,
  makeSendCampaign,
  makeUpdateCustomer,
} from "@/modules/customers/application/use-cases";
import { DrizzleCustomerRepository } from "@/modules/customers/infrastructure/drizzle-customer-repository";
import { makeGetOutboxEmail, makeListOutbox, makeRetryEmail, makeSendEmail, makeSendTestEmail } from "@/modules/mail/application/use-cases";
import { describeMailer, resolveMailerConfig, resolveSupportEmail } from "@/modules/mail/domain/email";
import { DrizzleEmailOutbox } from "@/modules/mail/infrastructure/drizzle-email-outbox";
import { createMailer } from "@/modules/mail/infrastructure/mailers";
import {
  makeCountUnreadNotifications,
  makeGetNotificationPreferences,
  makeListNotifications,
  makeMarkAllNotificationsRead,
  makeMarkNotificationRead,
  makeNotify,
  makeSaveNotificationPreferences,
} from "@/modules/notifications/application/use-cases";
import { DrizzleNotificationPreferenceRepository } from "@/modules/notifications/infrastructure/drizzle-notification-preference-repository";
import {
  makeGetInvoice,
  makeGetInvoiceOverview,
  makeListInvoiceableOrders,
  makeListInvoices,
  makeSendInvoice,
  makeSendInvoiceReminder,
} from "@/modules/invoices/application/use-cases";
import { DrizzleInvoiceRepository } from "@/modules/invoices/infrastructure/drizzle-invoice-repository";
import { makeGetReport } from "@/modules/reports/application/use-cases";
import { DrizzleReportsRepository } from "@/modules/reports/infrastructure/drizzle-reports-repository";
import { DrizzleNotificationRepository } from "@/modules/notifications/infrastructure/drizzle-notification-repository";
import { makeGlobalSearch } from "@/modules/search/application/use-cases";
import { DrizzleSearchRepository } from "@/modules/search/infrastructure/drizzle-search-repository";
import {
  makeChangeOrderStatus,
  makeCreateOrder,
  makeDeleteOrder,
  makeDeletePayment,
  makeGetOrder,
  makeGetSalesOverview,
  makeListOrders,
  makeListPayments,
  makeRecordPayment,
  makeUpdateOrder,
} from "@/modules/sales/application/use-cases";
import { DrizzleOrderRepository } from "@/modules/sales/infrastructure/drizzle-order-repository";
import { DrizzlePaymentRepository } from "@/modules/sales/infrastructure/drizzle-payment-repository";
import { systemClock } from "@/modules/shared-types";
import {
  makeAddSubtask,
  makeCreateTask,
  makeDeleteSubtask,
  makeDeleteTask,
  makeDuplicateTask,
  makeGetTaskBoard,
  makeGetTaskDetail,
  makeMoveTask,
  makeRenameSubtask,
  makeSetBlockedReason,
  makeToggleSubtask,
  makeUpdateTask,
} from "@/modules/tasks/application/use-cases";
import {
  makeDeleteTaskAttachment,
  makeGetAttachmentFile,
  makeListTaskAttachments,
  makeUploadTaskAttachment,
} from "@/modules/tasks/application/attachment-use-cases";
import { makeDeleteTimeEntry, makeListTimeEntries, makeLogTime } from "@/modules/tasks/application/time-use-cases";
import { makeAddTaskComment, makeDeleteTaskComment, makeEditTaskComment, makeListTaskComments } from "@/modules/tasks/application/comment-use-cases";
import { DrizzleTaskAttachmentRepository } from "@/modules/tasks/infrastructure/drizzle-task-attachment-repository";
import { DrizzleTaskCommentRepository } from "@/modules/tasks/infrastructure/drizzle-task-comment-repository";
import { DrizzleTaskTimeEntryRepository } from "@/modules/tasks/infrastructure/drizzle-task-time-entry-repository";
import { LocalAttachmentStorage, resolveUploadsDir } from "@/modules/tasks/infrastructure/local-attachment-storage";
import { DrizzleTaskRepository } from "@/modules/tasks/infrastructure/drizzle-task-repository";
import { resolveAuthEnv } from "@/modules/auth/domain/auth-env";
import {
  makeAcceptInvitation,
  makeAddTeammate,
  makeChangeMemberRole,
  makeGetInvitation,
  makeInviteMember,
  makeListRoster,
  makeRemoveMember,
  makeRevokeInvitation,
  makeUpdateMemberProfile,
} from "@/modules/team/application/team-use-cases";
import { DrizzleInvitationDirectory } from "@/modules/team/infrastructure/drizzle-invitation-directory";
import { DrizzleMemberRepository } from "@/modules/team/infrastructure/drizzle-member-repository";
import { DrizzleTeamRepository } from "@/modules/team/infrastructure/drizzle-team-repository";
import { makeCreateWorkspace, makeDeleteWorkspace, makeListMyWorkspaces, makeUpdateWorkspace } from "@/modules/workspaces/application/use-cases";
import { DrizzleWorkspaceDirectory } from "@/modules/workspaces/infrastructure/drizzle-workspace-directory";
import { db } from "./db/client";

const clock = systemClock;
const workspaceDirectory = new DrizzleWorkspaceDirectory(db);
const invitationDirectory = new DrizzleInvitationDirectory(db);
/** SMTP when `SMTP_HOST` is set, otherwise the log transport (outbox only). */
const mailerConfig = resolveMailerConfig(process.env);
const mailer = createMailer(mailerConfig);
/** Public origin for links in emails (invitations, notifications, invoices). */
const appBaseUrl = resolveAuthEnv(process.env).baseURL;
/** Task attachment bytes on local disk: `UPLOADS_DIR` or `data/uploads`, one folder per workspace. */
const attachmentStorage = new LocalAttachmentStorage(resolveUploadsDir(process.env));

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
    payments: new DrizzlePaymentRepository(db, workspaceId),
    invoices: new DrizzleInvoiceRepository(db, workspaceId),
    reports: new DrizzleReportsRepository(db, workspaceId),
    tasks: new DrizzleTaskRepository(db, workspaceId),
    taskComments: new DrizzleTaskCommentRepository(db, workspaceId),
    taskAttachments: new DrizzleTaskAttachmentRepository(db, workspaceId),
    taskTimeEntries: new DrizzleTaskTimeEntryRepository(db, workspaceId),
    activity: new DrizzleActivityRepository(db, workspaceId),
    members: new DrizzleMemberRepository(db, workspaceId),
    team: new DrizzleTeamRepository(db, workspaceId),
    notificationPreferences: new DrizzleNotificationPreferenceRepository(db, workspaceId),
    dashboard: new DrizzleDashboardRepository(db, workspaceId),
    notifications: new DrizzleNotificationRepository(db, workspaceId),
    outbox: new DrizzleEmailOutbox(db, workspaceId),
    search: new DrizzleSearchRepository(db, workspaceId),
  };
  const sendEmail = makeSendEmail({ outbox: repositories.outbox, mailer, clock });
  // In-app notifications respect each member's preferences; email-enabled types are also sent through the outbox.
  const notify = makeNotify({ notifications: repositories.notifications, preferences: repositories.notificationPreferences, sendEmail, baseUrl: appBaseUrl, clock });
  // `notify` is an optional dependency of task, sales and dashboard use cases (they emit notifications).
  const deps = { ...repositories, workspaceId, attachmentStorage, clock, notify, sendEmail, mailer, baseUrl: appBaseUrl };

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
      update: makeUpdateCustomer(deps),
      archive: makeArchiveCustomers(deps),
      applyTier: makeApplyCustomerTier(deps),
      delete: makeDeleteCustomer(deps),
      deleteMany: makeDeleteCustomers(deps),
      sendCampaign: makeSendCampaign(deps),
    },
    sales: {
      list: makeListOrders(deps),
      create: makeCreateOrder(deps),
      changeStatus: makeChangeOrderStatus(deps),
      get: makeGetOrder(deps),
      overview: makeGetSalesOverview(deps),
      update: makeUpdateOrder(deps),
      delete: makeDeleteOrder(deps),
      payments: makeListPayments(deps),
      recordPayment: makeRecordPayment(deps),
      deletePayment: makeDeletePayment(deps),
    },
    invoices: {
      list: makeListInvoices(deps),
      overview: makeGetInvoiceOverview(deps),
      get: makeGetInvoice(deps),
      /** Emails the invoice (kind "invoice") to the client's billing or contact address; check the returned outbox status. */
      send: makeSendInvoice(deps),
      sendReminder: makeSendInvoiceReminder(deps),
      invoiceable: makeListInvoiceableOrders(deps),
    },
    reports: {
      get: makeGetReport(deps),
    },
    tasks: {
      board: makeGetTaskBoard(deps),
      create: makeCreateTask(deps),
      move: makeMoveTask(deps),
      update: makeUpdateTask(deps),
      delete: makeDeleteTask(deps),
      duplicate: makeDuplicateTask(deps),
      setBlockedReason: makeSetBlockedReason(deps),
      detail: makeGetTaskDetail(deps),
      toggleSubtask: makeToggleSubtask(deps),
      addSubtask: makeAddSubtask(deps),
      renameSubtask: makeRenameSubtask(deps),
      deleteSubtask: makeDeleteSubtask(deps),
      comments: makeListTaskComments(deps),
      addComment: makeAddTaskComment(deps),
      editComment: makeEditTaskComment(deps),
      deleteComment: makeDeleteTaskComment(deps),
      attachments: makeListTaskAttachments(deps),
      uploadAttachment: makeUploadTaskAttachment(deps),
      deleteAttachment: makeDeleteTaskAttachment(deps),
      attachmentFile: makeGetAttachmentFile(deps),
      timeEntries: makeListTimeEntries(deps),
      logTime: makeLogTime(deps),
      deleteTimeEntry: makeDeleteTimeEntry(deps),
    },
    team: {
      /** Active members (pickers, assignment). */
      members: () => repositories.members.list(),
      roster: makeListRoster(deps),
      addTeammate: makeAddTeammate(deps),
      /** Existing users join directly; others get an emailed invite link (kind "invite"). */
      invite: makeInviteMember(deps),
      revokeInvitation: makeRevokeInvitation(deps),
      changeRole: makeChangeMemberRole(deps),
      remove: makeRemoveMember(deps),
      updateProfile: makeUpdateMemberProfile(deps),
    },
    activity: {
      recent: makeListRecentActivity(deps),
    },
    dashboard: {
      overview: makeGetDashboard(deps),
      sendReminder: makeSendPaymentReminder(deps),
    },
    notifications: {
      /** `notify({ recipientIds, actorId, type, title, body?, href? })`: skips the actor and foreign members. */
      notify,
      list: makeListNotifications(deps),
      unreadCount: makeCountUnreadNotifications(deps),
      markRead: makeMarkNotificationRead(deps),
      markAllRead: makeMarkAllNotificationsRead(deps),
      preferences: makeGetNotificationPreferences({ preferences: repositories.notificationPreferences }),
      savePreferences: makeSaveNotificationPreferences({ preferences: repositories.notificationPreferences }),
    },
    mail: {
      /** Persists to the outbox, then delivers (SMTP or log); returns the entry with its final status. */
      send: sendEmail,
      /** Owners and admins only (the use cases enforce it). */
      outbox: makeListOutbox(deps),
      get: makeGetOutboxEmail(deps),
      retry: makeRetryEmail(deps),
      sendTest: makeSendTestEmail(deps),
      transport: mailer.transport,
      /** Transport, sender and SMTP host (no credentials). */
      config: describeMailer(mailerConfig),
    },
    search: {
      global: makeGlobalSearch(deps),
    },
  } as const;
}

export type WorkspaceApp = ReturnType<typeof forWorkspace>;

/** Cross-workspace services (the tenant directory). */
export const directory = {
  clock,
  listMyWorkspaces: makeListMyWorkspaces({ workspaces: workspaceDirectory }),
  createWorkspace: makeCreateWorkspace({ workspaces: workspaceDirectory, clock }),
  updateWorkspace: makeUpdateWorkspace({ workspaces: workspaceDirectory }),
  /** Owners only; refuses the user's last workspace. Removes the workspace's attachment files too. */
  deleteWorkspace: makeDeleteWorkspace({ workspaces: workspaceDirectory, attachmentStorage }),
  renameUserMembers: (userId: string, name: string) => workspaceDirectory.renameUserMembers(userId, name),
  invitation: makeGetInvitation({ invitations: invitationDirectory, clock }),
  acceptInvitation: makeAcceptInvitation({ invitations: invitationDirectory, clock }),
  baseUrl: appBaseUrl,
  supportEmail: resolveSupportEmail(process.env),
} as const;
