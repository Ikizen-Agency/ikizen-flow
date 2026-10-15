import "server-only";
import type { WorkspaceApp } from "@/server/container";
import { toCsv } from "@/shared/domain/csv";
import { firstParam, type SearchParamsRecord } from "../../customers/application/list-params";
import { REPORT_SECTIONS, reportSectionCsv, type ReportSection } from "../domain/report-csv";

/** CSV of one report section for the requested range, or null for an unknown section. */
export async function exportReportCsv(app: WorkspaceApp, params: SearchParamsRecord): Promise<{ csv: string; fileName: string } | null> {
  const section = firstParam(params.section) as ReportSection | undefined;
  if (!section || !REPORT_SECTIONS.includes(section)) return null;
  const report = await app.reports.get({ preset: firstParam(params.preset), from: firstParam(params.from), to: firstParam(params.to) });
  // The file name only contains the validated section and ISO dates.
  return { csv: toCsv(reportSectionCsv(section, report)), fileName: `report-${section}-${report.range.fromInput}-to-${report.range.toInput}.csv` };
}
