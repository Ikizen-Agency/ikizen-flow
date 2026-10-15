import { connection } from "next/server";
import { getWorkspaceApp } from "@/server/request-context";
import { formatMoney } from "@/shared/domain/money";
import { formatPercent, ratio } from "@/shared/domain/stats";
import { toIsoDate } from "@/shared/domain/time";
import { buttonClasses } from "@/shared/ui/button";
import { DataTable } from "@/shared/ui/data-table";
import { hrefWith } from "@/shared/ui/href";
import { Field, Input } from "@/shared/ui/input";
import { PageHeader } from "@/shared/ui/page-header";
import { firstParam, type SearchParamsRecord } from "../../customers/application/list-params";
import { PeriodPicker } from "../../dashboard/ui/components/period-picker";
import { ORDER_CATEGORY_LABELS } from "../../sales/domain/order";
import { OrderStatusBadge } from "../../sales/ui/components/order-status-badge";
import { REPORT_PRESET_LABELS, REPORT_PRESETS, reportRangeUrlParams } from "../domain/date-range";
import type { ReportSection as Section } from "../domain/report-csv";
import { BarList, ReportSection, Stat } from "./components/report-parts";
import { GroupedBarChart } from "./components/grouped-bar-chart";

const PATH = "/reports";
const hours = (minutes: number) => `${(minutes / 60).toFixed(1)} h`;
const days = (n: number | null) => (n === null ? "—" : `${n} days`);

/** Container for /reports: resolves the URL date range, aggregates every section and renders them. */
export async function ReportsWorkspace({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await connection();
  const params = await searchParams;
  const { app } = await getWorkspaceApp(PATH);
  const report = await app.reports.get({ preset: firstParam(params.preset), from: firstParam(params.from), to: firstParam(params.to) });
  const { range, revenue, categories, customers, pipeline, aging, tasks, time } = report;
  const rangeParams = reportRangeUrlParams(range);
  const exportHref = (section: Section) => hrefWith(`${PATH}/export`, { section, ...rangeParams });
  const collectionRate = revenue.billedCents > 0 ? formatPercent(ratio(revenue.collectedCents, revenue.billedCents)) : "—";

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        eyebrow="Analytics"
        title="Reports"
        description={range.label}
        actions={
          <PeriodPicker
            label={REPORT_PRESET_LABELS[range.preset]}
            options={REPORT_PRESETS.filter((p) => p !== "custom").map((preset) => ({ label: REPORT_PRESET_LABELS[preset], href: hrefWith(PATH, { preset }), active: range.preset === preset }))}
          />
        }
      />

      <form action={PATH} className="flex flex-wrap items-end gap-space-sm rounded-card border border-line bg-card p-space-md shadow-level-1" aria-label="Custom date range">
        <input type="hidden" name="preset" value="custom" />
        <Field label="From" htmlFor="report-from">
          <Input id="report-from" type="date" name="from" defaultValue={range.fromInput} required />
        </Field>
        <Field label="To" htmlFor="report-to">
          <Input id="report-to" type="date" name="to" defaultValue={range.toInput} required />
        </Field>
        <button type="submit" className={buttonClasses({ variant: "secondary" })}>
          Apply custom range
        </button>
        <p className="text-body-sm text-ink-subtle">All figures are for the active workspace; receivables aging is as of today ({toIsoDate(report.now)}).</p>
      </form>

      <ReportSection id="revenue" title="Revenue over time" description="Billed (issue date) vs collected (payment date), by month" exportHref={exportHref("revenue")}>
        <GroupedBarChart
          id="revenue-chart"
          title="Billed vs collected by month"
          series={[
            { key: "billed", label: "Billed", color: "var(--color-chart-1)", total: formatMoney(revenue.billedCents, { decimals: false }) },
            { key: "collected", label: "Collected", color: "var(--color-chart-2)", total: formatMoney(revenue.collectedCents, { decimals: false }) },
          ]}
          points={revenue.months.map((m) => ({
            label: m.label,
            values: [m.billedCents, m.collectedCents],
            displays: [formatMoney(m.billedCents, { decimals: false }), formatMoney(m.collectedCents, { decimals: false })],
          }))}
        />
        <dl className="grid grid-cols-1 gap-space-md border-t border-line-soft pt-space-md sm:grid-cols-3">
          <Stat label="Billed" value={formatMoney(revenue.billedCents)} />
          <Stat label="Collected" value={formatMoney(revenue.collectedCents)} />
          <Stat label="Collected vs billed" value={collectionRate} />
        </dl>
        <DataTable
          caption="Revenue by month"
          rows={revenue.months}
          rowKey={(m) => m.label}
          columns={[
            { key: "month", header: "Month", cell: (m) => <span className="text-ink">{m.label}</span> },
            { key: "billed", header: "Billed", align: "right", cell: (m) => formatMoney(m.billedCents) },
            { key: "collected", header: "Collected", align: "right", cell: (m) => formatMoney(m.collectedCents) },
          ]}
        />
      </ReportSection>

      <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-2">
        <ReportSection id="categories" title="Revenue by category" description={`${formatMoney(categories.totalCents, { decimals: false })} billed in the range`} exportHref={exportHref("categories")}>
          <BarList
            empty="No billed orders in this range."
            rows={categories.categories.map((c) => ({
              key: c.category,
              label: ORDER_CATEGORY_LABELS[c.category],
              value: c.cents,
              display: `${formatMoney(c.cents, { decimals: false })} · ${c.percent}%`,
              detail: `${c.orders} order${c.orders === 1 ? "" : "s"} · ${c.customers} client${c.customers === 1 ? "" : "s"}`,
            }))}
          />
        </ReportSection>

        <ReportSection id="aging" title="Accounts receivable aging" description={`${formatMoney(aging.totalCents)} unpaid on issued invoices, by days past due`} exportHref={exportHref("aging")}>
          <BarList
            empty="No unpaid invoices."
            rows={aging.buckets.map((b) => ({
              key: b.bucket,
              label: b.label,
              value: b.cents,
              display: formatMoney(b.cents, { decimals: false }),
              detail: `${b.count} invoice${b.count === 1 ? "" : "s"}`,
            }))}
          />
        </ReportSection>
      </div>

      <ReportSection id="customers" title="Top customers" description="Ranked by billed amount in the range" exportHref={exportHref("customers")}>
        <DataTable
          caption="Top customers"
          rows={customers}
          rowKey={(c) => c.customerId}
          empty={<p className="px-space-md py-space-lg text-center text-ink-subtle">No customer activity in this range.</p>}
          columns={[
            { key: "client", header: "Client", cell: (c) => <span className="text-ink">{c.company}</span> },
            { key: "billed", header: "Billed", align: "right", cell: (c) => formatMoney(c.billedCents) },
            { key: "collected", header: "Collected", align: "right", cell: (c) => formatMoney(c.collectedCents) },
            { key: "outstanding", header: "Outstanding", align: "right", cell: (c) => formatMoney(c.outstandingCents) },
            { key: "orders", header: "Orders", align: "right", cell: (c) => c.orders },
          ]}
        />
      </ReportSection>

      <ReportSection id="pipeline" title="Sales pipeline by status" description="Orders issued in the range; overdue is derived from due dates" exportHref={exportHref("pipeline")}>
        <DataTable
          caption="Sales pipeline by status"
          rows={pipeline}
          rowKey={(p) => p.status}
          columns={[
            { key: "status", header: "Status", cell: (p) => <OrderStatusBadge status={p.status} /> },
            { key: "count", header: "Orders", align: "right", cell: (p) => p.count },
            { key: "amount", header: "Amount", align: "right", cell: (p) => formatMoney(p.cents) },
          ]}
        />
      </ReportSection>

      <ReportSection id="tasks" title="Task throughput" description="Tasks created vs completed per week" exportHref={exportHref("tasks")}>
        <dl className="grid grid-cols-2 gap-space-md sm:grid-cols-4">
          <Stat label="Created" value={String(tasks.createdCount)} />
          <Stat label="Completed" value={String(tasks.completedCount)} />
          <Stat label="Average cycle time" value={days(tasks.averageCycleDays)} />
          <Stat label="Overdue now" value={String(tasks.overdueCount)} />
        </dl>
        <GroupedBarChart
          id="throughput-chart"
          title="Tasks created vs completed per week"
          format="count"
          series={[
            { key: "created", label: "Created", color: "var(--color-chart-1)", total: String(tasks.createdCount) },
            { key: "completed", label: "Completed", color: "var(--color-chart-2)", total: String(tasks.completedCount) },
          ]}
          points={tasks.weeks.map((w) => ({ label: w.label, values: [w.created, w.completed], displays: [String(w.created), String(w.completed)] }))}
        />
        <div className="flex items-center justify-between gap-space-md border-t border-line-soft pt-space-md">
          <h3 className="text-label-md font-semibold text-ink">By assignee</h3>
          <a href={exportHref("assignees")} download className="text-body-sm text-accent hover:underline">
            Export CSV
          </a>
        </div>
        <DataTable
          caption="Task throughput by assignee"
          rows={tasks.byAssignee}
          rowKey={(a) => a.assigneeId ?? "unassigned"}
          empty={<p className="px-space-md py-space-lg text-center text-ink-subtle">No task activity in this range.</p>}
          columns={[
            { key: "name", header: "Assignee", cell: (a) => <span className="text-ink">{a.name}</span> },
            { key: "created", header: "Created", align: "right", cell: (a) => a.created },
            { key: "completed", header: "Completed", align: "right", cell: (a) => a.completed },
            { key: "cycle", header: "Avg cycle", align: "right", cell: (a) => days(a.averageCycleDays) },
          ]}
        />
      </ReportSection>

      <ReportSection id="time" title="Team time logged" description={`${hours(time.totalMinutes)} logged on tasks in the range`} exportHref={exportHref("time")}>
        <BarList
          empty="No time logged in this range."
          rows={time.members.map((m) => ({
            key: String(m.memberId ?? "former"),
            label: m.name,
            value: m.minutes,
            display: hours(m.minutes),
            detail: `${m.entries} entr${m.entries === 1 ? "y" : "ies"} · ${m.tasks} task${m.tasks === 1 ? "" : "s"}`,
          }))}
        />
      </ReportSection>
    </div>
  );
}

export function ReportsWorkspaceSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-space-lg" aria-busy="true" aria-label="Loading reports">
      <div className="h-16 w-1/3 rounded-card bg-well" />
      <div className="h-20 rounded-card bg-well" />
      <div className="h-96 rounded-card bg-well" />
      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-2">
        <div className="h-64 rounded-card bg-well" />
        <div className="h-64 rounded-card bg-well" />
      </div>
    </div>
  );
}
