import Link from "next/link";
import { connection } from "next/server";
import { getWorkspaceApp } from "@/server/request-context";
import { formatMoney } from "@/shared/domain/money";
import { formatPercent } from "@/shared/domain/stats";
import { formatDate, formatRelativeTime } from "@/shared/domain/time";
import { CreateNewMenu } from "@/shared/shell/create-new-menu";
import { hrefWith } from "@/shared/ui/href";
import { Icon } from "@/shared/ui/icon";
import { PageHeader } from "@/shared/ui/page-header";
import { ACTIVITY_CATEGORY_LABELS } from "../../activity/domain/activity";
import type { SearchParamsRecord } from "../../customers/application/list-params";
import { effectiveOrderStatus, ORDER_CATEGORIES, ORDER_CATEGORY_LABELS, type OrderCategory } from "../../sales/domain/order";
import { describeTaskDue } from "../../tasks/domain/board";
import { taskDueState, type TaskPriority } from "../../tasks/domain/task";
import { activeFilterCount, dashboardFilterParams, parseDashboardParams } from "../application/params";
import { DASHBOARD_PERIODS, greetingFor, periodRange, type CategoryRevenue } from "../domain/dashboard";
import { ActivityCard } from "./components/activity-card";
import { CategoryCard } from "./components/category-card";
import { CriticalTasksCard, type CriticalTaskItem } from "./components/critical-tasks-card";
import { DashboardFilters } from "./components/dashboard-filters";
import { KpiCards } from "./components/kpi-cards";
import { OverdueReceivables } from "./components/overdue-receivables";
import { PeriodPicker } from "./components/period-picker";
import { RecentSalesCard } from "./components/recent-sales-card";
import { RevenueTrendCard } from "./components/revenue-trend-card";

const PATH = "/";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const CATEGORY_DETAIL: Record<OrderCategory, (c: CategoryRevenue) => string> = {
  custom_software: (c) => plural(c.orders, "Contract"),
  ux_ui_retainer: (c) => plural(c.customers, "Active Client"),
  cloud_architecture: (c) => plural(c.orders, "Infrastructure Audit"),
};

const PRIORITY: Record<TaskPriority, CriticalTaskItem["priority"]> = {
  urgent: { label: "Urgent", tone: "danger" },
  high: { label: "High", tone: "warning" },
  medium: { label: "Normal", tone: "neutral" },
  low: { label: "Low", tone: "neutral" },
};

const HUE_INDEX = Object.fromEntries(ORDER_CATEGORIES.map((c, i) => [c, i]));
const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/** Container: aggregates the overview from the database and renders the executive cockpit. */
export async function OverviewDashboard({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await connection();
  const query = parseDashboardParams(await searchParams);
  const { ctx, app } = await getWorkspaceApp("/");
  const [view, customerOptions, memberOptions] = await Promise.all([app.dashboard.overview(query), app.repositories.customers.listOptions(), app.team.members()]);
  const { now } = view;
  const firstName = ctx.member.name.split(" ")[0] || "there";
  const baseState = { period: query.period === "month" ? undefined : query.period, metric: query.metric === "gross" ? undefined : query.metric };
  const filterState = dashboardFilterParams(query.filters);
  const urlState = { ...baseState, ...filterState };
  const filterCount = activeFilterCount(query.filters);
  const chips = [
    query.filters.category ? { key: "category", label: ORDER_CATEGORY_LABELS[query.filters.category] } : null,
    query.filters.customerId ? { key: "customer", label: customerOptions.find((c) => c.id === query.filters.customerId)?.company ?? "Unknown customer" } : null,
    query.filters.assigneeId ? { key: "assignee", label: memberOptions.find((m) => m.id === query.filters.assigneeId)?.name ?? "Unknown member" } : null,
  ].filter((c) => c !== null);

  const peak = view.trend.points[view.trend.peakIndex];
  const metricLabel = query.metric === "gross" ? "Gross revenue" : "Collected cash";

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        eyebrow="Executive Cockpit"
        title={`${greetingFor(now)}, ${firstName}.`}
        description={`Here is what's happening across ${ctx.workspace.name} today.`}
        actions={
          <>
            <PeriodPicker
              label={view.range.label}
              options={DASHBOARD_PERIODS.map((p) => ({
                label: periodRange(p, now).label,
                href: hrefWith(PATH, urlState, { period: p === "month" ? undefined : p }),
                active: p === query.period,
              }))}
            />
            <DashboardFilters
              categories={ORDER_CATEGORIES.map((c) => ({ value: c, label: ORDER_CATEGORY_LABELS[c] }))}
              customers={customerOptions}
              members={memberOptions}
              current={{ category: query.filters.category, customer: query.filters.customerId, assignee: query.filters.assigneeId }}
              keep={baseState}
              activeCount={filterCount}
              clearHref={hrefWith(PATH, baseState)}
            />
            <CreateNewMenu />
          </>
        }
      />

      {chips.length > 0 ? (
        <div className="-mt-space-sm flex flex-wrap items-center gap-space-xs" aria-label="Active filters">
          <span className="text-label-sm text-ink-subtle">Filtered by</span>
          {chips.map((chip) => (
            <Link
              key={chip.key}
              href={hrefWith(PATH, urlState, { [chip.key]: undefined })}
              scroll={false}
              className="inline-flex items-center gap-1 rounded-full border border-primary-fixed bg-accent-tint px-2.5 py-0.5 text-label-sm text-accent hover:bg-primary-fixed"
            >
              {chip.label}
              <Icon name="close" size={14} />
              <span className="sr-only">Remove filter</span>
            </Link>
          ))}
          <Link href={hrefWith(PATH, baseState)} scroll={false} className="text-label-sm text-ink-muted hover:text-ink hover:underline">
            Clear filters
          </Link>
        </div>
      ) : null}

      <KpiCards
        sales={{
          value: formatMoney(view.sales.cents, { decimals: false }),
          change: view.sales.change === null ? null : { label: formatPercent(view.sales.change, { signed: true }), positive: view.sales.change >= 0 },
          comparison: view.range.comparison,
          sparkline: view.sales.sparkline.map((p) => ({ label: p.label, value: p.cents, display: formatMoney(p.cents, { decimals: false }) })),
        }}
        outstanding={{ value: formatMoney(view.outstanding.cents, { decimals: false }), dueSoon: view.outstanding.dueSoon }}
        customers={view.customers}
        attention={view.attention}
      />

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-gutter lg:col-span-8">
          <RevenueTrendCard
            badge={`${now.getUTCMonth() < 6 ? "H1" : "H2"} Performance`}
            subtitle={
              peak && peak.cents > 0
                ? `Six month historical curve peaking at ${formatMoney(peak.cents, { decimals: false })} ${peak.current ? "in current cycle" : `in ${peak.label}`}`
                : "No revenue recorded in the last six months"
            }
            metricLabel={metricLabel}
            points={view.trend.points.map((p) => ({ label: p.label, value: p.cents, display: formatMoney(p.cents, { decimals: false }) }))}
            peakIndex={view.trend.peakIndex}
            toggles={[
              { label: "Gross Revenue", href: hrefWith(PATH, urlState, { metric: undefined }), active: query.metric === "gross" },
              { label: "Collected Cash", href: hrefWith(PATH, urlState, { metric: "collected" }), active: query.metric === "collected" },
            ]}
            highlights={[
              { label: "Average Deal Size", value: formatMoney(view.averageDealCents, { decimals: false }) },
              { label: "Collection Velocity", value: view.onTimeRate === null ? "No payments yet" : `${formatPercent(view.onTimeRate)} on-time`, tone: "success" },
              { label: "Projected Run Rate", value: formatMoney(view.runRateCents, { decimals: false }), tone: "accent" },
            ]}
          />
          <RecentSalesCard
            ledgerHref="/sales?view=all"
            rows={view.recentOrders.map((o) => ({
              reference: o.reference,
              href: `/sales?order=${o.reference}`,
              company: o.customerCompany,
              title: o.title,
              date: formatDate(o.issueDate),
              amount: formatMoney(o.amountCents),
              status: effectiveOrderStatus(o, now),
            }))}
          />
          <OverdueReceivables
            total={view.overdue.total}
            items={view.overdue.items.map((o) => ({
              reference: o.reference,
              daysOverdue: o.daysOverdue,
              company: o.customerCompany,
              detail: `Invoice #${o.invoiceNumber ?? o.reference} • ${o.title}`,
              amount: formatMoney(o.amountCents),
              contact: o.contactEmail,
            }))}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-gutter lg:col-span-4">
          <CategoryCard
            hueIndex={HUE_INDEX}
            rows={view.categories.categories.map((c) => ({
              key: c.category,
              label: ORDER_CATEGORY_LABELS[c.category],
              detail: CATEGORY_DETAIL[c.category](c),
              amount: formatMoney(c.cents, { decimals: false }),
              percent: c.percent,
            }))}
          />
          <CriticalTasksCard
            dueToday={view.critical.dueToday}
            items={view.critical.items.map((t) => {
              const state = taskDueState(t, now);
              const due =
                state === "today"
                  ? `Today, ${clock.format(t.dueAt)}`
                  : state === "tomorrow"
                    ? `Tomorrow, ${clock.format(t.dueAt)}`
                    : (describeTaskDue(t, now)?.label ?? "");
              return {
                id: t.id,
                title: t.title,
                priority: PRIORITY[t.priority],
                due,
                overdue: state === "overdue",
                assignee: t.assigneeName,
                href: `/tasks?task=${t.id}`,
              };
            })}
          />
          <ActivityCard
            renderedAt={now.toISOString()}
            viewAllHref="/activity"
            items={view.activity.map((a) => ({
              id: a.id,
              actor: a.actorName ?? "System",
              message: a.message,
              category: a.category,
              meta: `${formatRelativeTime(a.createdAt, now)} • ${ACTIVITY_CATEGORY_LABELS[a.category]}`,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

export function OverviewDashboardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-space-lg" aria-busy="true" aria-label="Loading overview">
      <div className="h-20 rounded-card bg-well" />
      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-36 rounded-card bg-well" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
        <div className="h-96 rounded-card bg-well lg:col-span-8" />
        <div className="h-96 rounded-card bg-well lg:col-span-4" />
      </div>
    </div>
  );
}
