import { getWorkspaceApp } from "@/server/request-context";
import { NotificationBell } from "./notification-bell";
import { loadNotificationPage } from "./queries";

/** Server part of the topbar bell: reads the signed-in member's notifications (render inside `<Suspense>`). */
export async function NotificationsMenu() {
  const { ctx, app } = await getWorkspaceApp();
  return <NotificationBell initial={await loadNotificationPage(app, ctx.member.id)} />;
}

export function NotificationsMenuSkeleton() {
  return <span className="block size-8 animate-pulse rounded-control bg-surface-container-low" aria-hidden />;
}
