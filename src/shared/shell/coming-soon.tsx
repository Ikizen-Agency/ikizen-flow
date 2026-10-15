import Link from "next/link";
import { buttonClasses } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeader } from "@/shared/ui/page-header";

export interface ComingSoonProps {
  title: string;
  description: string;
  icon: string;
}

/** Tidy placeholder for workspace sections that are not built yet. */
export function ComingSoon({ title, description, icon }: ComingSoonProps) {
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState
          icon={icon}
          title={`${title} is coming soon`}
          description="This area of Ikizen Flow is on the roadmap. In the meantime, the overview, customers, sales and tasks workspaces are fully operational."
          action={
            <Link href="/" className={buttonClasses({ variant: "secondary" })}>
              Back to overview
            </Link>
          }
        />
      </Card>
    </div>
  );
}
