import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

type Align = "left" | "right" | "center";

const alignClass: Record<Align, string> = {
  left: "text-left",
  right: "text-right tabular",
  center: "text-center",
};

/* Low-level parts: use them when a table needs custom row markup. */

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-body-md", className)} {...rest} />
    </div>
  );
}

export function THead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-line bg-canvas", className)} {...rest} />;
}

export function TH({ align = "left", className, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { align?: Align }) {
  return (
    <th
      scope="col"
      className={cn(
        "h-11 px-space-md text-label-sm tracking-[0.05em] whitespace-nowrap text-ink-subtle uppercase",
        alignClass[align],
        className,
      )}
      {...rest}
    />
  );
}

export function TR({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("h-12 border-b border-line-soft bg-card transition-colors last:border-b-0 hover:bg-canvas", className)}
      {...rest}
    />
  );
}

export function TD({ align = "left", className, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { align?: Align }) {
  return <td className={cn("px-space-md py-space-sm text-ink-muted", alignClass[align], className)} {...rest} />;
}

/* High-level, column-driven table. */

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  align?: Align;
  className?: string;
  cell: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: ReadonlyArray<DataTableColumn<T>>;
  rows: ReadonlyArray<T>;
  rowKey: (row: T) => string | number;
  /** Rendered in a full-width row when `rows` is empty. */
  empty?: ReactNode;
  caption?: string;
  className?: string;
}

export function DataTable<T>({ columns, rows, rowKey, empty, caption, className }: DataTableProps<T>) {
  return (
    <Table className={className}>
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      <THead>
        <tr>
          {columns.map((col) => (
            <TH key={col.key} align={col.align} className={col.className}>
              {col.header}
            </TH>
          ))}
        </tr>
      </THead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="bg-card">
              {empty ?? <p className="px-space-md py-space-lg text-center text-ink-subtle">No records yet.</p>}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <TR key={rowKey(row)}>
              {columns.map((col) => (
                <TD key={col.key} align={col.align} className={col.className}>
                  {col.cell(row)}
                </TD>
              ))}
            </TR>
          ))
        )}
      </tbody>
    </Table>
  );
}
