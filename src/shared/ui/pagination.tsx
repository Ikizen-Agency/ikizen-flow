import Link from "next/link";
import { cn } from "@/shared/lib/cn";
import { Icon } from "./icon";
import { paginationRange } from "./pagination-range";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  /** Builds the link for a page number. */
  hrefFor: (page: number) => string;
  className?: string;
}

const pageButton = "inline-flex h-8 min-w-8 items-center justify-center rounded-sm px-2 text-label-sm transition-colors";

/** "Showing 1 to 6 of 128 results" summary plus URL-driven page links. */
export function Pagination({ page, pageSize, total, hrefFor, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const edge = (enabled: boolean, target: number, label: string, icon: string, trailing = false) => {
    const content = (
      <>
        {trailing ? null : <Icon name={icon} size={16} />}
        <span>{label}</span>
        {trailing ? <Icon name={icon} size={16} /> : null}
      </>
    );
    const cls = cn(pageButton, "gap-1 border border-line bg-card px-3 shadow-level-1");
    return enabled ? (
      <Link href={hrefFor(target)} scroll={false} className={cn(cls, "text-ink hover:bg-well")}>
        {content}
      </Link>
    ) : (
      <span aria-disabled="true" className={cn(cls, "cursor-not-allowed text-ink-subtle opacity-60")}>
        {content}
      </span>
    );
  };

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex flex-col items-center justify-between gap-space-md bg-surface-container-low p-space-md sm:flex-row", className)}
    >
      <p className="text-body-sm text-ink-subtle">
        Showing <span className="font-medium text-ink">{from}</span> to <span className="font-medium text-ink">{to}</span> of{" "}
        <span className="font-medium text-ink">{total}</span> results
      </p>
      <div className="flex items-center gap-1">
        {edge(page > 1, page - 1, "Previous", "chevron_left")}
        {paginationRange(page, totalPages).map((item, i) =>
          item === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-label-sm text-ink-subtle">
              ...
            </span>
          ) : item === page ? (
            <span key={item} aria-current="page" className={cn(pageButton, "bg-accent text-white")}>
              {item}
            </span>
          ) : (
            <Link
              key={item}
              href={hrefFor(item)}
              scroll={false}
              className={cn(pageButton, "border border-line bg-card text-ink shadow-level-1 hover:bg-well")}
            >
              {item}
            </Link>
          ),
        )}
        {edge(page < totalPages, page + 1, "Next", "chevron_right", true)}
      </div>
    </nav>
  );
}
