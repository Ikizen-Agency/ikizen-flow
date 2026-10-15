import { Fragment } from "react";
import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ui/card";
import type { ActivityCategory } from "../../../activity/domain/activity";

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

const REFERENCE = /(#[A-Z]+-\d+)/g;

/** Highlights record references ("#INV-2041") inside an activity sentence. */
function Message({ text }: { text: string }) {
  return text.split(REFERENCE).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="text-accent">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export function ActivityCard({ items }: { items: ReadonlyArray<ActivityItem> }) {
  return (
    <Card className="flex flex-col gap-space-md" aria-labelledby="activity-title">
      <div className="flex items-center justify-between gap-space-sm">
        <h2 id="activity-title" className="text-headline-sm text-ink">
          Recent Team Activity
        </h2>
        <span className="flex items-center gap-1.5 text-label-sm text-ink-subtle">
          <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden />
          Live Sync
        </span>
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
                  <span className="font-semibold">{a.actor}</span> <Message text={a.message} />
                </p>
                <p className="mt-0.5 text-label-sm text-ink-subtle">{a.meta}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
