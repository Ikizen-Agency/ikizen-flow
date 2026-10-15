"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspaceApp } from "@/server/request-context";
import { loadNotificationPage } from "./queries";
import type { NotificationPageView } from "./view";

/** The signed-in member's notifications in the active workspace (unread first). */
export async function loadNotificationsAction(page: number = 1): Promise<NotificationPageView> {
  const { ctx, app } = await getWorkspaceApp();
  const safePage = z.coerce.number().int().min(1).max(1000).catch(1).parse(page);
  return loadNotificationPage(app, ctx.member.id, safePage);
}

/** Marks one of the member's notifications read. Returns its in-app link (null when not found). */
export async function markNotificationReadAction(id: number): Promise<{ href: string | null }> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = z.coerce.number().int().positive().safeParse(id);
  if (!parsed.success) return { href: null };
  const notification = await app.notifications.markRead(ctx.member.id, parsed.data);
  revalidatePath("/", "layout");
  return { href: notification?.href ?? null };
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const { ctx, app } = await getWorkspaceApp();
  await app.notifications.markAllRead(ctx.member.id);
  revalidatePath("/", "layout");
}
