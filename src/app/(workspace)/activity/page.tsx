import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityFeed, ActivityFeedSkeleton } from "@/modules/activity/ui/activity-feed";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage({ searchParams }: PageProps<"/activity">) {
  return (
    <Suspense fallback={<ActivityFeedSkeleton />}>
      <ActivityFeed searchParams={searchParams} />
    </Suspense>
  );
}
