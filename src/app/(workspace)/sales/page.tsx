import type { Metadata } from "next";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeader } from "@/shared/ui/page-header";

export const metadata: Metadata = { title: "Sales" };

// Placeholder: implemented in a later task.
export default function SalesPage() {
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader title="Sales" description="Author commercial commitments, track orders and reconcile billing." />
      <Card>
        <EmptyState icon="trending_up" title="Nothing here yet" description="This workspace is being connected to live data." />
      </Card>
    </div>
  );
}
