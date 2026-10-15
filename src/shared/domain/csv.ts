export type CsvCell = string | number | null | undefined;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  let text = String(cell);
  // Prevent CSV formula injection when the file is opened in a spreadsheet.
  if (typeof cell === "string" && FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serialises rows to RFC 4180 CSV (CRLF line endings). */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<CsvCell>>): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}
