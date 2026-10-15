import Link from "next/link";
import { connection } from "next/server";
import { getWorkspaceApp } from "@/server/request-context";
import { formatMoney } from "@/shared/domain/money";
import { formatDate, toIsoDate } from "@/shared/domain/time";
import { cn } from "@/shared/lib/cn";
import { buttonClasses } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { DataTable, type DataTableColumn } from "@/shared/ui/data-table";
import { hrefWith } from "@/shared/ui/href";
import { Icon } from "@/shared/ui/icon";
import { Field, Input, Select } from "@/shared/ui/input";
import { KpiTile } from "@/shared/ui/kpi-tile";
import { PageHeader } from "@/shared/ui/page-header";
import { Pagination } from "@/shared/ui/pagination";
import type { SearchParamsRecord } from "../../customers/application/list-params";
import { ORDER_STATUS_LABELS } from "../../sales/domain/order";
import { orderBalance } from "../../sales/domain/payment";
import { invoiceListUrlParams, parseInvoiceListParams } from "../application/list-params";
import { INVOICE_TAB_LABELS, INVOICE_TABS, invoiceStatus, type InvoiceStatus } from "../domain/invoice";
import { InvoiceRowMenu } from "./components/invoice-actions";
import { InvoiceStatusBadge } from "./components/invoice-document";
import { IssueInvoiceCard } from "./components/issue-invoice-card";

const PATH = "/invoices";

interface InvoiceRow {
  invoiceNumber: string;
  reference: string;
  company: string;
  issued: string;
  due: string;
  total: string;
  paid: string;
  balance: string;
  status: InvoiceStatus;
  href: string;
}

export const invoiceHref = (invoiceNumber: string) => `${PATH}/${encodeURIComponent(invoiceNumber)}`;

const columns: ReadonlyArray<DataTableColumn<InvoiceRow>> = [
  {
    key: "number",
    header: "Invoice",
    cell: (r) => (
      <Link href={r.href} className="tabular font-semibold text-ink hover:text-accent">
        {r.invoiceNumber}
        <span className="block text-body-sm font-normal text-ink-subtle">{r.reference}</span>
      </Link>
    ),
  },
  { key: "client", header: "Client", cell: (r) => <span className="text-ink">{r.company}</span> },
  { key: "issued", header: "Issued", cell: (r) => <span className="whitespace-nowrap">{r.issued}</span> },
  { key: "due", header: "Due", cell: (r) => <span className="whitespace-nowrap">{r.due}</span> },
  { key: "total", header: "Total", align: "right", cell: (r) => r.total },
  { key: "paid", header: "Paid", align: "right", cell: (r) => <span className="text-success">{r.paid}</span> },
  { key: "balance", header: "Balance", align: "right", cell: (r) => <span className="font-semibold text-ink">{r.balance}</span> },
  { key: "status", header: "Status", cell: (r) => <InvoiceStatusBadge status={r.status} /> },
  {
    key: "actions",
    header: <span className="sr-only">Actions</span>,
    align: "right",
    cell: (r) => (
      <InvoiceRowMenu
        invoiceNumber={r.invoiceNumber}
        company={r.company}
        balance={r.balance}
        unpaid={r.status !== "paid"}
        viewHref={r.href}
        triggerClassName="rounded-control p-1.5 text-ink-subtle hover:bg-well hover:text-ink"
      />
    ),
  },
];

/** Container for /invoices: KPIs, URL-driven filters, the invoice table and "Issue an Invoice". */
export async function InvoicesWorkspace({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await connection();
  const query = parseInvoiceListParams(await searchParams);
  const urlParams = invoiceListUrlParams(query);
  const { app } = await getWorkspaceApp(PATH);
  const [overview, page, customers, invoiceable] = await Promise.all([
    app.invoices.overview(),
    app.invoices.list(query),
    app.customers.list({ page: 1, pageSize: 500, sort: "company" }),
    app.invoices.invoiceable(),
  ]);
  const { now, kpis, counts } = overview;

  const rows: InvoiceRow[] = page.items.map((o) => ({
    invoiceNumber: o.invoiceNumber ?? o.reference,
    reference: o.reference,
    company: o.customerCompany,
    issued: formatDate(o.issueDate),
    due: formatDate(o.dueDate),
    total: formatMoney(o.amountCents),
    paid: formatMoney(o.paidCents),
    balance: formatMoney(orderBalance(o)),
    status: invoiceStatus(o, now),
    href: invoiceHref(o.invoiceNumber ?? o.reference),
  }));
  const filtered = Boolean(query.search || query.customerId || query.issuedFrom || query.issuedTo);

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        eyebrow="Billing"
        title="Invoices"
        description="Issue, send and reconcile client invoices. Balances and payments come straight from the sales ledger."
        actions={
          <a href={hrefWith(`${PATH}/export`, urlParams)} download className={buttonClasses({ variant: "secondary" })}>
            <Icon name="file_download" size={18} />
            Export CSV
          </a>
        }
      />

      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Outstanding" icon="account_balance_wallet" value={formatMoney(kpis.outstandingCents)} footer={`${kpis.openCount} unpaid invoice${kpis.openCount === 1 ? "" : "s"}`} />
        <KpiTile
          label="Overdue"
          icon="error"
          tone={kpis.overdueCount > 0 ? "danger" : "success"}
          value={formatMoney(kpis.overdueCents)}
          footer={
            <Link href={hrefWith(PATH, { status: "overdue" })} className="hover:text-ink">
              {kpis.overdueCount} invoice{kpis.overdueCount === 1 ? "" : "s"} past due
            </Link>
          }
        />
        <KpiTile label="Collected this month" icon="payments" tone="success" value={formatMoney(kpis.collectedCents)} footer={`Since ${formatDate(kpis.collectedSince)}`} />
        <KpiTile
          label="Average days to pay"
          icon="schedule"
          tone="neutral"
          value={kpis.averageDaysToPay === null ? "—" : `${kpis.averageDaysToPay} days`}
          footer={`Across ${kpis.paidCount} paid invoice${kpis.paidCount === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-12">
        <Card flush className="lg:col-span-9" aria-labelledby="invoice-list-title">
          <div className="flex flex-col gap-space-md p-5">
            <h2 id="invoice-list-title" className="text-headline-md text-ink">
              Invoice Register
            </h2>
            <nav aria-label="Filter by status" className="flex flex-wrap gap-space-xs">
              {INVOICE_TABS.map((tab) => (
                <Link
                  key={tab}
                  href={hrefWith(PATH, { ...urlParams, status: tab === "all" ? undefined : tab })}
                  scroll={false}
                  aria-current={query.tab === tab ? "page" : undefined}
                  className={cn(
                    "rounded-full px-3 py-1 text-label-sm transition-colors",
                    query.tab === tab ? "bg-accent text-white" : "border border-line bg-card text-ink-muted hover:bg-well",
                  )}
                >
                  {INVOICE_TAB_LABELS[tab]} ({counts[tab]})
                </Link>
              ))}
            </nav>
            <form action={PATH} role="search" className="grid grid-cols-1 gap-space-sm sm:grid-cols-2 xl:grid-cols-[2fr_1.5fr_1fr_1fr_auto] xl:items-end">
              {query.tab !== "all" ? <input type="hidden" name="status" value={query.tab} /> : null}
              <Field label="Search" htmlFor="invoice-q">
                <Input id="invoice-q" type="search" name="q" defaultValue={query.search ?? ""} placeholder="Invoice #, order or client" />
              </Field>
              <Field label="Client" htmlFor="invoice-customer">
                <Select id="invoice-customer" name="customerId" defaultValue={query.customerId ? String(query.customerId) : ""}>
                  <option value="">All clients</option>
                  {customers.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Issued from" htmlFor="invoice-from">
                <Input id="invoice-from" type="date" name="from" defaultValue={urlParams.from ?? ""} />
              </Field>
              <Field label="Issued to" htmlFor="invoice-to">
                <Input id="invoice-to" type="date" name="to" defaultValue={urlParams.to ?? ""} max={toIsoDate(now)} />
              </Field>
              <div className="flex gap-space-sm">
                <button type="submit" className={buttonClasses()}>
                  <Icon name="filter_list" size={18} />
                  Apply
                </button>
                {filtered ? (
                  <Link href={hrefWith(PATH, { status: urlParams.status })} className={buttonClasses({ variant: "ghost" })}>
                    Reset
                  </Link>
                ) : null}
              </div>
            </form>
          </div>
          <DataTable
            caption="Invoices"
            columns={columns}
            rows={rows}
            rowKey={(r) => r.reference}
            empty={<p className="px-space-md py-space-lg text-center text-ink-subtle">No invoices match these filters.</p>}
          />
          <Pagination page={page.page} pageSize={page.pageSize} total={page.total} hrefFor={(p) => hrefWith(PATH, { ...urlParams, page: p > 1 ? p : undefined })} />
        </Card>
        <div className="lg:col-span-3">
          <IssueInvoiceCard
            orders={invoiceable.map((o) => ({
              reference: o.reference,
              label: `${o.reference} · ${o.customerCompany} · ${formatMoney(o.amountCents, { decimals: false })} (${ORDER_STATUS_LABELS[o.status]})`,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

export function InvoicesWorkspaceSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-space-lg" aria-busy="true" aria-label="Loading invoices">
      <div className="h-16 w-1/3 rounded-card bg-well" />
      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-36 rounded-card bg-well" />
        ))}
      </div>
      <div className="h-[32rem] rounded-card bg-well" />
    </div>
  );
}
