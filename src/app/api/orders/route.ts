import { connection, type NextRequest } from "next/server";
import { authorizeRoute } from "@/server/request-context";
import { toCsv } from "@/shared/domain/csv";
import { parseOrderListParams } from "@/modules/sales/application/list-params";
import { effectiveOrderStatus, ORDER_STATUS_LABELS } from "@/modules/sales/domain/order";
import { orderBalance } from "@/modules/sales/domain/payment";

/**
 * GET /api/orders: paginated order list as JSON (or CSV with `format=csv`).
 * Requires a session (401 otherwise); results are limited to the active workspace.
 * Query: status (incl. derived "overdue"), q, customerId, page, pageSize (max 100).
 * Each item includes `paidCents` (sum of payments) and `balanceCents` (amount still due).
 */
export async function GET(request: NextRequest) {
  await connection();
  const auth = await authorizeRoute();
  if (auth instanceof Response) return auth;
  const { app } = auth;
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const query = parseOrderListParams(params, { pageSize: 20, allowPageSize: true });
  const page = await app.sales.list(query);
  const now = app.clock();
  const items = page.items.map((o) => ({
    reference: o.reference,
    customer: { id: o.customerId, company: o.customerCompany },
    title: o.title,
    category: o.category,
    status: o.status,
    effectiveStatus: effectiveOrderStatus(o, now),
    amountCents: o.amountCents,
    paidCents: o.paidCents,
    balanceCents: orderBalance(o),
    invoiceNumber: o.invoiceNumber,
    issueDate: o.issueDate.toISOString(),
    dueDate: o.dueDate.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
  }));

  if (params.format === "csv") {
    const csv = toCsv([
      ["Reference", "Client", "Title", "Status", "Amount (USD)", "Paid (USD)", "Balance (USD)", "Invoice", "Issued", "Due"],
      ...items.map((o) => [
        o.reference,
        o.customer.company,
        o.title,
        ORDER_STATUS_LABELS[o.effectiveStatus],
        (o.amountCents / 100).toFixed(2),
        (o.paidCents / 100).toFixed(2),
        (o.balanceCents / 100).toFixed(2),
        o.invoiceNumber,
        o.issueDate.slice(0, 10),
        o.dueDate.slice(0, 10),
      ]),
    ]);
    return new Response(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="sales-ledger.csv"', "Cache-Control": "no-store" },
    });
  }

  return Response.json(
    { items, page: page.page, pageSize: page.pageSize, total: page.total },
    { headers: { "Cache-Control": "no-store" } },
  );
}
