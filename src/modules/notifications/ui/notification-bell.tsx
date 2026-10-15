"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui/icon";
import { NOTIFICATION_ICONS } from "../domain/notification";
import { loadNotificationsAction, markAllNotificationsReadAction, markNotificationReadAction } from "./actions";
import type { NotificationPageView, NotificationView } from "./view";

/** Topbar bell: unread badge from the database and a Level 2 panel listing the member's notifications. */
export function NotificationBell({ initial }: { initial: NotificationPageView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // A server re-render (after revalidation) brings fresh data.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setData(initial);
  }

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      startTransition(async () => {
        try {
          setData(await loadNotificationsAction(1));
          setError(null);
        } catch {
          setError("Could not load notifications.");
        }
      });
    }
  };

  const openNotification = (n: NotificationView) => {
    startTransition(async () => {
      try {
        const { href } = await markNotificationReadAction(n.id);
        setData((d) => ({
          ...d,
          unread: n.read ? d.unread : Math.max(0, d.unread - 1),
          items: d.items.map((i) => (i.id === n.id ? { ...i, read: true } : i)),
        }));
        if (href) {
          setOpen(false);
          router.push(href);
        }
      } catch {
        setError("Could not update the notification.");
      }
    });
  };

  const markAll = () => {
    startTransition(async () => {
      try {
        await markAllNotificationsReadAction();
        setData((d) => ({ ...d, unread: 0, items: d.items.map((i) => ({ ...i, read: true })) }));
      } catch {
        setError("Could not mark notifications as read.");
      }
    });
  };

  const loadMore = () => {
    startTransition(async () => {
      try {
        const next = await loadNotificationsAction(data.page + 1);
        setData((d) => ({ ...next, items: [...d.items, ...next.items.filter((n) => !d.items.some((i) => i.id === n.id))] }));
      } catch {
        setError("Could not load more notifications.");
      }
    });
  };

  const label = data.unread > 0 ? `Notifications, ${data.unread} unread` : "Notifications";

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        title="Notifications"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        className="relative rounded-control p-space-xs text-ink-muted transition-colors hover:bg-well hover:text-ink"
      >
        <Icon name="notifications" size={20} filled={open} />
        {data.unread > 0 ? (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-card"
            aria-hidden
          >
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panel}
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          tabIndex={-1}
          className="fixed inset-x-space-md top-[calc(var(--spacing-topbar,64px)+4px)] z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-card border border-line-strong bg-card shadow-level-2 outline-none sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-line px-space-md py-space-sm">
            <p className="text-headline-sm text-ink">
              Notifications
              {data.unread > 0 ? <span className="ml-space-xs text-body-sm text-ink-subtle">{data.unread} unread</span> : null}
            </p>
            <button
              type="button"
              onClick={markAll}
              disabled={pending || data.unread === 0}
              className="text-label-md text-accent hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              Mark all as read
            </button>
          </div>
          {error ? (
            <p role="alert" className="px-space-md py-space-xs text-body-sm text-danger-strong">
              {error}
            </p>
          ) : null}
          {data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-space-xs px-space-md py-space-xl text-center">
              <Icon name="notifications_none" size={28} className="text-outline" />
              <p className="text-body-sm text-ink-subtle">You are all caught up.</p>
            </div>
          ) : (
            <ul className="flex-1 divide-y divide-line overflow-y-auto" aria-busy={pending}>
              {data.items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(n)}
                    className={cn(
                      "flex w-full items-start gap-space-sm px-space-md py-space-sm text-left transition-colors hover:bg-canvas",
                      !n.read && "bg-accent-tint/40",
                    )}
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-accent">
                      <Icon name={NOTIFICATION_ICONS[n.type]} size={18} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={cn("text-label-md", n.read ? "text-ink-muted" : "text-ink")}>{n.title}</span>
                      {n.body ? <span className="line-clamp-2 text-body-sm text-ink-subtle">{n.body}</span> : null}
                      <span className="text-body-sm text-outline">{n.relative}</span>
                    </span>
                    {!n.read ? (
                      <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" role="img" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data.hasMore ? (
            <button
              type="button"
              onClick={loadMore}
              disabled={pending}
              className="border-t border-line px-space-md py-space-sm text-label-md text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-50"
            >
              Load more
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
