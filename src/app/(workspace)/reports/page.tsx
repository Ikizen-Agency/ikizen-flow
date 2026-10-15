import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportsWorkspace, ReportsWorkspaceSkeleton } from "@/modules/reports/ui/reports-workspace";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <Suspense fallback={<ReportsWorkspaceSkeleton />}>
      <ReportsWorkspace searchParams={searchParams} />
    </Suspense>
  );
}
