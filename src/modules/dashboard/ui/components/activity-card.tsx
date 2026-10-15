import Link from "next/link";
import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ui/card";
import type { ActivityCategory } from "../../../activity/domain/activity";
import { ActivityMessage } from "../../../activity/ui/activity-message";
import { LiveSync } from "./live-sync";

export interface ActivityItem {
  id: number;
  actor: string;
  message: string;
  category: ActivityCategory;
  meta: string;
}

const DOT: Record<ActivityCategory, string> = {
  billing: "bg-success",
  pipeline: "bg-accent",
  strategy: "bg-tertiary",
  development: "bg-outline",
  operations: "bg-warning",
};

export function ActivityCard({ items, renderedAt, viewAllHref }: { items: ReadonlyArray<ActivityItem>; renderedAt: string; viewAllHref: string }) {
  return (
    <Card className="flex flex-col gap-space-md" aria-labelledby="activity-title">
      <div className="flex items-center justify-between gap-space-sm">
        <h2 id="activity-title" className="text-headline-sm text-ink">
          Recent Team Activity
        </h2>
        <LiveSync renderedAt={renderedAt} />
      </div>
      {items.length === 0 ? (
        <p className="text-body-sm text-ink-subtle">No team activity yet.</p>
      ) : (
        <ol className="flex flex-col">
          {items.map((a, i) => (
            <li key={a.id} className="relative flex gap-space-sm pb-space-md last:pb-0">
              {i < items.length - 1 ? <span className="absolute top-4 bottom-0 left-[4px] w-px bg-line" aria-hidden /> : null}
              <span className={cn("relative mt-1.5 size-2.5 shrink-0 rounded-full", DOT[a.category])} aria-hidden />
              <div className="min-w-0">
                <p className="text-body-sm text-ink">
                  <span className="font-semibold">{a.actor}</span> <ActivityMessage text={a.message} />
                </p>
                <p className="mt-0.5 text-label-sm text-ink-subtle">{a.meta}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <Link href={viewAllHref} className="self-start text-label-md text-accent hover:underline">
        View all activity
      </Link>
    </Card>
  );
}
