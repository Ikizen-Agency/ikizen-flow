import Link from "next/link";
import { Badge } from "@/shared/ui/badge";
import { buttonClasses } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { KpiTile } from "@/shared/ui/kpi-tile";
import { BulkActionsMenu } from "./bulk-actions-menu";

export interface CustomersHeaderProps {
  workspaceName: string;
  totalAccounts: number;
  newThisQuarter: number;
  pipeline: string;
  /** e.g. "↑ 18.4%"; null when there is no prior period to compare with. */
  pipelineTrend: { label: string; positive: boolean } | null;
  retention: string;
  addHref: string;
  exportHref: string;
}

export function CustomersHeader({
  workspaceName,
  totalAccounts,
  newThisQuarter,
  pipeline,
  pipelineTrend,
  retention,
  addHref,
  exportHref,
}: CustomersHeaderProps) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-gutter lg:grid-cols-12">
      <div className="flex flex-col justify-between gap-space-md lg:col-span-7">
        <div>
          <div className="mb-space-xs flex flex-wrap items-center gap-space-sm">
            <h1 className="text-headline-lg text-ink">Customers</h1>
            <Badge className="rounded-full">{totalAccounts} total accounts</Badge>
            {newThisQuarter > 0 ? (
              <Badge tone="success" className="rounded-full">
                +{newThisQuarter} this quarter
              </Badge>
            ) : null}
          </div>
          <p className="max-w-2xl text-body-md text-ink-muted">
            Manage client relationships, billing terms, active contracts, and engagement history across {workspaceName}
            operations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <Link href={addHref} scroll={false} className={buttonClasses({ variant: "primary" })}>
            <Icon name="person_add" size={18} />
            Add Customer
          </Link>
          <a href={exportHref} download className={buttonClasses({ variant: "secondary" })}>
            <Icon name="file_download" size={18} />
            Export CSV
          </a>
          <BulkActionsMenu />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:col-span-5">
        <KpiTile
          label="Active Pipeline"
          icon="show_chart"
          tone="success"
          value={pipeline}
          footer={
            pipelineTrend ? (
              <span className="flex items-center gap-1.5">
                <span className={pipelineTrend.positive ? "font-medium text-success" : "font-medium text-danger"}>
                  {pipelineTrend.label}
                </span>
                billings vs prior month
              </span>
            ) : (
              "No prior-month billings to compare"
            )
          }
        />
        <KpiTile label="Client Health" icon="verified" tone="accent" value={retention} footer="Retention rate (engaged accounts)" />
      </div>
    </div>
  );
}
