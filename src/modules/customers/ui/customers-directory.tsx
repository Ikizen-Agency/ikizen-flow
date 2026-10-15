import { connection } from "next/server";
import { getWorkspaceApp } from "@/server/request-context";
import type { BadgeTone } from "@/shared/ui/badge";
import { hrefWith } from "@/shared/ui/href";
import { Pagination } from "@/shared/ui/pagination";
import { formatMoney } from "@/shared/domain/money";
import { formatPercent } from "@/shared/domain/stats";
import { formatDate, formatLastActivity } from "@/shared/domain/time";
import { effectiveOrderStatus, ORDER_STATUS_LABELS, PAYMENT_TERMS, PAYMENT_TERMS_LABELS, type EffectiveOrderStatus } from "../../sales/domain/order";
import { firstParam, parseCustomerListParams, type SearchParamsRecord } from "../application/list-params";
import { CUSTOMER_STATUS_LABELS, CUSTOMER_STATUSES, CUSTOMER_TIER_LABELS, CUSTOMER_TIERS } from "../domain/customer";
import { CreateCustomerDialog } from "./components/create-customer-dialog";
import { CustomerDrawer, type InteractionItem } from "./components/customer-drawer";
import { CustomerDrawerActions } from "./components/customer-drawer-actions";
import { CustomerSelectionProvider } from "./components/customer-selection";
import { EditCustomerDialog } from "./components/edit-customer-dialog";
import { CustomerFilters } from "./components/customer-filters";
import { CustomerTable } from "./components/customer-table";
import { CustomersHeader } from "./components/customers-header";
import { NEW_CUSTOMER_STATUSES } from "./form-schema";

const PATH = "/customers";

const STATUS_OPTIONS = CUSTOMER_STATUSES.map((value) => ({ value, label: CUSTOMER_STATUS_LABELS[value] }));
const TIER_OPTIONS = CUSTOMER_TIERS.map((value) => ({ value, label: CUSTOMER_TIER_LABELS[value] }));
const NEW_STATUS_OPTIONS = NEW_CUSTOMER_STATUSES.map((value) => ({ value, label: CUSTOMER_STATUS_LABELS[value] }));
const TERMS_OPTIONS = PAYMENT_TERMS.map((value) => ({ value, label: PAYMENT_TERMS_LABELS[value] }));

const positiveId = (value: string | undefined) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const SORT_OPTIONS = [
  { value: "last_active", label: "Last Active" },
  { value: "sales_desc", label: "Total Sales (High to Low)" },
  { value: "sales_asc", label: "Total Sales (Low to High)" },
  { value: "company", label: "Company Name" },
];

const ORDER_EVENT: Record<EffectiveOrderStatus, { icon: string; tone: BadgeTone }> = {
  draft: { icon: "edit_note", tone: "neutral" },
  pending: { icon: "schedule", tone: "warning" },
  processing: { icon: "autorenew", tone: "info" },
  invoiced: { icon: "description", tone: "info" },
  completed: { icon: "payments", tone: "success" },
  cancelled: { icon: "block", tone: "neutral" },
  overdue: { icon: "error", tone: "danger" },
};

/** Container: reads URL state and the database, then renders the presentational directory. */
export async function CustomersDirectory({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await connection();
  const params = await searchParams;
  const { ctx, app } = await getWorkspaceApp("/customers");
  const query = parseCustomerListParams(params);
  const now = app.clock();

  const filters = {
    q: query.search,
    status: query.status,
    tier: query.tier,
    sort: query.sort === "last_active" ? undefined : query.sort,
  };
  const listParams = { ...filters, page: query.page > 1 ? query.page : undefined };
  const customerId = positiveId(firstParam(params.customer));
  const editId = positiveId(firstParam(params.edit));
  const creating = firstParam(params.create) === "1";

  const [page, stats, profile, editing] = await Promise.all([
    app.customers.list(query),
    app.customers.stats(),
    customerId ? app.customers.profile(customerId) : Promise.resolve(null),
    editId ? app.customers.summary(editId) : Promise.resolve(null),
  ]);

  const rows = page.items.map((c) => ({
    id: c.id,
    company: c.company,
    tier: c.tier,
    status: c.status,
    contactName: c.contactName,
    contactEmail: c.contactEmail,
    lastActivity: formatLastActivity(c.lastActivityAt, now),
    totalSales: formatMoney(c.totalSalesCents, { decimals: false }),
    href: hrefWith(PATH, listParams, { customer: c.id }),
    editHref: hrefWith(PATH, listParams, { edit: c.id }),
  }));

  const trend = stats.billingTrend;
  const closeHref = hrefWith(PATH, listParams);

  return (
    <CustomerSelectionProvider>
    <div className="flex flex-col gap-space-lg">
      <CustomersHeader
        workspaceName={ctx.workspace.name}
        totalAccounts={stats.totalAccounts}
        newThisQuarter={stats.newThisQuarter}
        pipeline={formatMoney(stats.pipelineCents, { decimals: false })}
        pipelineTrend={trend === null ? null : { label: `${trend >= 0 ? "↑" : "↓"} ${formatPercent(Math.abs(trend))}`, positive: trend >= 0 }}
        retention={formatPercent(stats.retention)}
        addHref={hrefWith(PATH, listParams, { create: 1 })}
        exportHref={hrefWith(`${PATH}/export`, filters)}
        tierOptions={TIER_OPTIONS}
      />
      <CustomerFilters current={filters} statusOptions={STATUS_OPTIONS} tierOptions={TIER_OPTIONS} sortOptions={SORT_OPTIONS} />
      <CustomerTable
        rows={rows}
        footer={
          <Pagination
            page={page.page}
            pageSize={page.pageSize}
            total={page.total}
            hrefFor={(p) => hrefWith(PATH, listParams, { page: p > 1 ? p : undefined })}
          />
        }
      />

      {profile ? (
        <CustomerDrawer
          closeHref={closeHref}
          ordersHref={hrefWith("/sales", { q: profile.customer.company })}
          company={profile.customer.company}
          tier={profile.customer.tier}
          status={profile.customer.status}
          lifetimeValue={formatMoney(profile.customer.totalSalesCents, { decimals: false })}
          openDeals={profile.openDeals}
          healthScore={profile.healthScore}
          contactName={profile.customer.contactName}
          contactEmail={profile.customer.contactEmail}
          details={[
            { icon: "domain", label: "Industry", value: profile.customer.industry },
            { icon: "event_note", label: "Payment terms", value: PAYMENT_TERMS_LABELS[profile.customer.paymentTerms] },
            { icon: "mail", label: "Billing email", value: profile.customer.billingEmail ?? profile.customer.contactEmail },
            { icon: "account_balance_wallet", label: "Outstanding", value: formatMoney(profile.customer.outstandingCents) },
            { icon: "calendar_today", label: "Client since", value: formatDate(profile.customer.createdAt) },
          ]}
          manage={
            <CustomerDrawerActions
              id={profile.customer.id}
              company={profile.customer.company}
              status={profile.customer.baseStatus}
              tier={profile.customer.tier}
              archived={profile.customer.archivedAt !== null}
              statusOptions={NEW_STATUS_OPTIONS}
              tierOptions={TIER_OPTIONS}
              editHref={hrefWith(PATH, listParams, { edit: profile.customer.id })}
              closeHref={closeHref}
            />
          }
          interactions={profile.recentOrders.map((o): InteractionItem => {
            const status = effectiveOrderStatus(o, now);
            return {
              id: o.id,
              ...ORDER_EVENT[status],
              title: `Order #${o.reference} ${ORDER_STATUS_LABELS[status]}`,
              detail: `${o.title} · ${formatMoney(o.amountCents)}`,
              when: formatLastActivity(o.issueDate, now),
            };
          })}
        />
      ) : null}

      {creating ? <CreateCustomerDialog closeHref={closeHref} tierOptions={TIER_OPTIONS} statusOptions={NEW_STATUS_OPTIONS} /> : null}

      {editing ? (
        <EditCustomerDialog
          key={editing.id}
          closeHref={closeHref}
          customer={{
            id: editing.id,
            company: editing.company,
            tier: editing.tier,
            status: editing.baseStatus,
            industry: editing.industry,
            contactName: editing.contactName,
            contactEmail: editing.contactEmail,
            billingEmail: editing.billingEmail ?? "",
            paymentTerms: editing.paymentTerms,
          }}
          tierOptions={TIER_OPTIONS}
          statusOptions={NEW_STATUS_OPTIONS}
          termsOptions={TERMS_OPTIONS}
        />
      ) : null}
    </div>
    </CustomerSelectionProvider>
  );
}

export function CustomersDirectorySkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-space-lg" aria-busy="true" aria-label="Loading customers">
      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
        <div className="h-36 rounded-card bg-well lg:col-span-7" />
        <div className="h-36 rounded-card bg-well lg:col-span-5" />
      </div>
      <div className="h-20 rounded-card bg-well" />
      <div className="h-96 rounded-card bg-well" />
    </div>
  );
}
