import type { Metadata } from "next";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeader } from "@/shared/ui/page-header";

export const metadata: Metadata = { title: "Tasks" };

// Placeholder: implemented in a later task.
export default function TasksPage() {
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader title="Tasks &amp; Operations" description="Active operational sprints across Northstar Studio client accounts." />
      <Card>
        <EmptyState icon="check_box" title="Nothing here yet" description="This workspace is being connected to live data." />
      </Card>
    </div>
  );
}
