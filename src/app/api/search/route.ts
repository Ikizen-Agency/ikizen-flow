import { connection, type NextRequest } from "next/server";
import { customerHref, orderHref, SEARCH_GROUP_LIMIT, taskHref } from "@/modules/search/domain/search";
import { authorizeRoute } from "@/server/request-context";

/**
 * GET /api/search?q=: grouped global search over the active workspace (customers by company/contact,
 * orders by reference/invoice/title/description, tasks by code/title). Requires a session (401 otherwise).
 * Optional `limit` per group (1-10, default 5). Each hit carries the in-app `href` to open it.
 */
export async function GET(request: NextRequest) {
  await connection();
  const auth = await authorizeRoute();
  if (auth instanceof Response) return auth;
  const params = request.nextUrl.searchParams;
  const limit = Math.min(10, Math.max(1, Number(params.get("limit")) || SEARCH_GROUP_LIMIT));
  const results = await auth.app.search.global(params.get("q"), limit);
  return Response.json(
    {
      query: results.query,
      workspace: { id: auth.ctx.workspace.id, name: auth.ctx.workspace.name },
      customers: results.customers.map((c) => ({ ...c, href: customerHref(c) })),
      orders: results.orders.map((o) => ({ ...o, href: orderHref(o) })),
      tasks: results.tasks.map((t) => ({ ...t, href: taskHref(t) })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
