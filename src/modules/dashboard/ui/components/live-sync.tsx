"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export const LIVE_REFRESH_MS = 30_000;

function describeAge(seconds: number): string {
  if (seconds < 5) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `Updated ${minutes}m ago`;
}

/**
 * "Live Sync": re-renders the dashboard on the server (`router.refresh()`) every 30 s while the tab is visible,
 * pauses while it is hidden and catches up as soon as it becomes visible again. `renderedAt` changes with
 * every server render, which resets the "Updated Xs ago" label.
 */
export function LiveSync({ renderedAt }: { renderedAt: string }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const rendered = new Date(renderedAt).getTime();
  const renderedRef = useRef(rendered);

  useEffect(() => {
    renderedRef.current = rendered;
  }, [rendered]);

  useEffect(() => {
    const tick = () => {
      const visible = document.visibilityState === "visible";
      setPaused(!visible);
      setNow(Date.now());
      if (visible && Date.now() - renderedRef.current >= LIVE_REFRESH_MS) {
        renderedRef.current = Date.now();
        router.refresh();
      }
    };
    const timer = window.setInterval(tick, 1_000);
    document.addEventListener("visibilitychange", tick);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(first);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  const seconds = now === null ? 0 : Math.max(0, Math.floor((now - rendered) / 1000));
  return (
    <span className="flex items-center gap-1.5 text-label-sm text-ink-subtle" title={paused ? "Paused while this tab is hidden" : "Refreshes every 30 seconds"}>
      <span className={paused ? "size-1.5 rounded-full bg-outline" : "size-1.5 animate-pulse rounded-full bg-success"} aria-hidden />
      <span>Live Sync</span>
      <span aria-live="off" className="tabular">
        · {paused ? "Paused" : describeAge(seconds)}
      </span>
    </span>
  );
}
