import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { exportReportCsv } from "@/modules/reports/ui/export-csv";
import { authorizeRoute } from "@/server/request-context";

/** GET /reports/export?section=…&preset=… (or from/to): CSV of one report section. Requires a session (401 otherwise). */
export async function GET(request: NextRequest) {
  await connection();
  const auth = await authorizeRoute();
  if (auth instanceof Response) return auth;
  const result = await exportReportCsv(auth.app, Object.fromEntries(request.nextUrl.searchParams));
  if (!result) {
    return Response.json({ error: "invalid_section", message: "Unknown report section." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
