import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeader } from "@/shared/ui/page-header";

// Placeholder: the executive dashboard is implemented in T6.
export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        eyebrow="Executive cockpit"
        title="Good morning, Alex."
        description="Here is what's happening across Northstar Studio today."
      />
      <Card>
        <EmptyState icon="dashboard" title="Dashboard is being assembled" description="KPIs, revenue trends and team activity will appear here." />
      </Card>
    </div>
  );
}
