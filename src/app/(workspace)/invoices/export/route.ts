import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { exportInvoicesCsv } from "@/modules/invoices/ui/export-csv";
import { authorizeRoute } from "@/server/request-context";

/** GET /invoices/export: CSV of the filtered invoice list (same params as the page). Requires a session (401 otherwise). */
export async function GET(request: NextRequest) {
  await connection();
  const auth = await authorizeRoute();
  if (auth instanceof Response) return auth;
  const csv = await exportInvoicesCsv(auth.app, Object.fromEntries(request.nextUrl.searchParams));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
