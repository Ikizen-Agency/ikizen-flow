import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { exportCustomersCsv } from "@/modules/customers/ui/export-csv";
import { authorizeRoute } from "@/server/request-context";

/** GET /customers/export: CSV download of the directory, honouring the same filters as the page. Requires a session (401 otherwise). */
export async function GET(request: NextRequest) {
  await connection();
  const auth = await authorizeRoute();
  if (auth instanceof Response) return auth;
  const csv = await exportCustomersCsv(auth.app, Object.fromEntries(request.nextUrl.searchParams));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
