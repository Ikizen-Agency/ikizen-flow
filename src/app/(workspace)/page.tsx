import { Suspense } from "react";
import { OverviewDashboard, OverviewDashboardSkeleton } from "@/modules/dashboard/ui/overview-dashboard";

export default function OverviewPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<OverviewDashboardSkeleton />}>
      <OverviewDashboard searchParams={searchParams} />
    </Suspense>
  );
}
