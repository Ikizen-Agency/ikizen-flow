import type { Metadata } from "next";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeader } from "@/shared/ui/page-header";

export const metadata: Metadata = { title: "Customers" };

// Placeholder: implemented in a later task.
export default function CustomersPage() {
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader title="Customers" description="Manage client relationships, billing terms, active contracts, and engagement history across Northstar Studio operations." />
      <Card>
        <EmptyState icon="group" title="Nothing here yet" description="This workspace is being connected to live data." />
      </Card>
    </div>
  );
}
