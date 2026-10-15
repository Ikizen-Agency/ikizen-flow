import { connection } from "next/server";
import { container } from "@/server/container";
import { formatCompactMoney, formatMoney } from "@/shared/domain/money";
import { formatPercent, ratio } from "@/shared/domain/stats";
import { formatDate } from "@/shared/domain/time";
import { hrefWith } from "@/shared/ui/href";
import { Pagination } from "@/shared/ui/pagination";
import { firstParam, type SearchParamsRecord } from "../../customers/application/list-params";
import { parseOrderListParams } from "../application/list-params";
import type { OrderWithItems } from "../application/ports";
import {
  allowedOrderTransitions,
  effectiveOrderStatus,
  ORDER_CATEGORIES,
  ORDER_CATEGORY_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_TERMS,
  PAYMENT_TERMS_LABELS,
  type EffectiveOrderStatus,
  type OrderStatus,
} from "../domain/order";
import { OrderDrawer } from "./components/order-drawer";
import type { StatusActionOption } from "./components/order-status-actions";
import { SaleForm, type SaleItemDraft } from "./components/sale-form";
import { SalesKpis, type SalesKpi } from "./components/sales-kpis";
import { SalesRegister, type RegisterTab } from "./components/sales-register";
import { VelocityCard } from "./components/velocity-card";

const PATH = "/sales";
const REGISTER_PAGE_SIZE = 6;
const AUDIT_PAGE_SIZE = 20;
const TAB_ORDER: ReadonlyArray<EffectiveOrderStatus> = ["completed", "invoiced", "overdue", "processing", "pending", "draft", "cancelled"];

const RETAINER_TEMPLATE: SaleItemDraft[] = [
  {
    title: "Q4 UX Architecture & Prototyping Retainer",
    description: "Core user experience flows, design sprint facilitation, Figma design tokens",
    quantity: "1",
    unit: "unit",
    unitRate: "8500.00",
  },
  {
    title: "Cloud Infrastructure CI/CD Migration",
    description: "Automated deployment triggers, Dockerized staging containers, zero-downtime blue/green swap",
    quantity: "40",
    unit: "hours",
    unitRate: "165.00",
  },
];

const ACTION_COPY: Record<OrderStatus, { label: string; icon: string }> = {
  draft: { label: "Back to Draft", icon: "edit_note" },
  pending: { label: "Confirm Order", icon: "task_alt" },
  processing: { label: "Start Processing", icon: "autorenew" },
  invoiced: { label: "Issue Invoice", icon: "receipt_long" },
  completed: { label: "Mark as Paid", icon: "check_circle" },
  cancelled: { label: "Cancel Order", icon: "block" },
};

const trendChip = (change: number | null, icon: string) =>
  change === null ? undefined : { icon, label: formatPercent(change, { signed: true }), tone: change >= 0 ? ("success" as const) : ("danger" as const) };

function toDraftItems(order: OrderWithItems | null): SaleItemDraft[] | null {
  if (!order?.items.length) return null;
  return order.items.map((i) => ({
    title: i.title,
    description: i.description ?? "",
    quantity: String(i.quantity),
    unit: i.unit,
    unitRate: (i.unitRateCents / 100).toFixed(2),
  }));
}

/** Container for /sales: reads URL state and the database, renders the presentational screen. */
export async function SalesWorkspace({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await connection();
  const params = await searchParams;
  const auditView = firstParam(params.view) === "all";
  const query = parseOrderListParams(params, { pageSize: auditView ? AUDIT_PAGE_SIZE : REGISTER_PAGE_SIZE });
  const orderRef = firstParam(params.order);
  const listParams = {
    status: query.status,
    q: query.search,
    customerId: query.customerId,
    view: auditView ? "all" : undefined,
    page: auditView && query.page > 1 ? query.page : undefined,
  };

  const overview = await container.sales.overview();
  const { now, kpis, counts } = overview;
  const [register, customers, lastOrder, selected] = await Promise.all([
    container.sales.list({ ...query, page: auditView ? query.page : 1 }),
    container.customers.list({ page: 1, pageSize: 500, sort: "company" }),
    overview.latestReference ? container.sales.get(overview.latestReference) : Promise.resolve(null),
    orderRef ? container.sales.get(orderRef) : Promise.resolve(null),
  ]);

  const kpiTiles: SalesKpi[] = [
    {
      label: "Total Sales Period",
      value: formatMoney(kpis.periodSalesCents),
      caption: `vs. ${formatMoney(kpis.priorPeriodSalesCents)} prior window`,
      chip: trendChip(kpis.salesChange, "arrow_drop_up"),
      progress: ratio(kpis.periodSalesCents, Math.max(kpis.periodSalesCents, kpis.priorPeriodSalesCents)),
      barTone: "accent",
    },
    {
      label: "Pipeline Value",
      value: formatMoney(kpis.pipelineCents),
      caption: `Weighted expectation: ${formatMoney(kpis.weightedPipelineCents, { decimals: false })}`,
      chip: { icon: "trending_up", label: `${kpis.activeCount} Active`, tone: "success" },
      progress: ratio(kpis.weightedPipelineCents, kpis.pipelineCents),
      barTone: "success",
    },
    {
      label: "Average Deal Size",
      value: formatMoney(kpis.averageDealCents),
      caption: `Across ${kpis.executedCount} executed work orders`,
      chip: trendChip(kpis.averageDealChange, "show_chart"),
      progress: kpis.averageDealChange === null ? 0.5 : Math.min(1, 0.5 + kpis.averageDealChange / 2),
      barTone: "accent",
    },
    {
      label: "Conversion Rate",
      value: formatPercent(kpis.conversionRate),
      caption: "Proposal to execution turnaround",
      chip:
        kpis.conversionRate >= 0.6
          ? { icon: "verified", label: "High health", tone: "success" }
          : { icon: "warning", label: "Needs attention", tone: "danger" },
      progress: kpis.conversionRate,
      barTone: "success",
    },
  ];

  const tabParams = { q: query.search, customerId: query.customerId };
  const tabs: RegisterTab[] = [
    { label: "All", count: counts.all, href: hrefWith(PATH, tabParams), active: !query.status },
    ...TAB_ORDER.filter((s) => counts[s] > 0 || query.status === s).map((s) => ({
      label: ORDER_STATUS_LABELS[s],
      count: counts[s],
      href: hrefWith(PATH, tabParams, { status: s }),
      active: query.status === s,
    })),
  ];

  const closeHref = hrefWith(PATH, listParams);
  const selectedStatus = selected ? effectiveOrderStatus(selected, now) : null;

  return (
    <div className="flex flex-col gap-space-lg">
      <h1 className="sr-only">Sales</h1>
      <SalesKpis items={kpiTiles} />
      <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SaleForm
            key={overview.nextReference}
            customers={customers.items
              .filter((c) => c.status !== "archived")
              .map((c) => ({ id: c.id, company: c.company, email: c.billingEmail ?? c.contactEmail, outstandingCents: c.outstandingCents }))}
            categoryOptions={ORDER_CATEGORIES.map((value) => ({ value, label: ORDER_CATEGORY_LABELS[value] }))}
            termsOptions={PAYMENT_TERMS.map((value) => ({ value, label: PAYMENT_TERMS_LABELS[value] }))}
            nextReference={overview.nextReference}
            todayIso={now.toISOString()}
            retainerTemplate={RETAINER_TEMPLATE}
            lastOrderItems={toDraftItems(lastOrder)}
            highlighted={firstParam(params.create) === "1"}
          />
        </div>
        <div className="flex flex-col gap-gutter lg:col-span-5">
          <SalesRegister
            tabs={tabs}
            search={{ value: query.search ?? "", status: query.status }}
            exportHref={hrefWith("/api/orders", { status: query.status, q: query.search, customerId: query.customerId, format: "csv", pageSize: 100 })}
            rows={register.items.map((o) => ({
              reference: o.reference,
              company: o.customerCompany,
              status: effectiveOrderStatus(o, now),
              amount: formatMoney(o.amountCents),
              date: formatDate(o.issueDate),
              href: hrefWith(PATH, listParams, { order: o.reference }),
            }))}
            footer={
              auditView ? (
                <Pagination
                  className="-mx-5 -mb-5 rounded-b-card"
                  page={register.page}
                  pageSize={register.pageSize}
                  total={register.total}
                  hrefFor={(p) => hrefWith(PATH, { ...listParams, page: p > 1 ? p : undefined })}
                />
              ) : (
                <a
                  href={hrefWith(PATH, { ...listParams, view: "all" })}
                  className="rounded-control py-space-sm text-center text-label-md text-ink hover:bg-well"
                >
                  View Complete Audit Trail ({register.total} Orders)
                </a>
              )
            }
          />
          <VelocityCard
            onTimeLabel={overview.onTimeRate === null ? null : formatPercent(overview.onTimeRate)}
            engagement={
              overview.activeEngagement
                ? {
                    title: `${overview.activeEngagement.customerCompany} Engagement`,
                    subtitle: `${overview.activeEngagement.title} · due ${formatDate(overview.activeEngagement.dueDate)}`,
                  }
                : null
            }
            weekly={overview.weekly.map((value, i) => ({
              label: `Week ${i + 1}`,
              value,
              display: formatCompactMoney(value),
            }))}
            totalLabel={formatCompactMoney(overview.weekly.reduce((a, b) => a + b, 0))}
          />
        </div>
      </div>

      {selected && selectedStatus ? (
        <OrderDrawer
          closeHref={closeHref}
          reference={selected.reference}
          status={selectedStatus}
          storedStatusNote={
            selectedStatus === "overdue" ? `Overdue — stored status is ${ORDER_STATUS_LABELS[selected.status]}, payment was due ${formatDate(selected.dueDate)}.` : null
          }
          company={selected.customerCompany}
          customerHref={`/customers?customer=${selected.customerId}`}
          title={selected.title}
          facts={[
            { label: "Category", value: ORDER_CATEGORY_LABELS[selected.category] },
            { label: "Payment terms", value: PAYMENT_TERMS_LABELS[selected.paymentTerms] },
            { label: "Issued", value: formatDate(selected.issueDate) },
            { label: "Due", value: formatDate(selected.dueDate) },
            { label: "Invoice", value: selected.invoiceNumber ?? "Not issued" },
            { label: "Paid", value: selected.paidAt ? formatDate(selected.paidAt) : "Unpaid" },
          ]}
          items={selected.items.map((i) => ({
            id: i.id,
            title: i.title,
            description: i.description,
            quantity: i.unit === "hours" ? `${i.quantity} hrs` : String(i.quantity),
            rate: formatMoney(i.unitRateCents),
            total: formatMoney(i.quantity * i.unitRateCents),
          }))}
          totals={[
            { label: "Subtotal", value: formatMoney(selected.subtotalCents) },
            { label: "Discount", value: `-${formatMoney(selected.discountCents)}` },
            { label: "Tax", value: formatMoney(selected.taxCents) },
            { label: "Total", value: formatMoney(selected.amountCents), strong: true },
          ]}
          actions={allowedOrderTransitions(selected.status).map((status): StatusActionOption => ({ status, ...ACTION_COPY[status] }))}
        />
      ) : null}
    </div>
  );
}

export function SalesWorkspaceSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-space-lg" aria-busy="true" aria-label="Loading sales">
      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-card bg-well" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
        <div className="h-[48rem] rounded-card bg-well lg:col-span-7" />
        <div className="h-[32rem] rounded-card bg-well lg:col-span-5" />
      </div>
    </div>
  );
}
