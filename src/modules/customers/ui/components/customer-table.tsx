"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { EmptyState } from "@/shared/ui/empty-state";
import { Icon } from "@/shared/ui/icon";
import type { CustomerStatus, CustomerTier } from "../../domain/customer";
import { CompanyTile, CustomerStatusBadge, TierTag } from "./customer-badges";

/** Display-ready directory row (formatting happens on the server). */
export interface CustomerRow {
  id: number;
  company: string;
  tier: CustomerTier;
  status: CustomerStatus;
  contactName: string;
  contactEmail: string;
  lastActivity: string;
  totalSales: string;
  href: string;
}

const iconButton = "rounded-control p-1.5 text-ink-subtle transition-colors hover:bg-surface-container";

export function CustomerTable({ rows, footer }: { rows: ReadonlyArray<CustomerRow>; footer?: ReactNode }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-line bg-card shadow-level-1">
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Customer directory</caption>
          <thead>
            <tr className="h-12 bg-surface-container-low text-label-sm tracking-wider text-ink-subtle uppercase">
              <th scope="col" className="w-12 py-3 pl-4">
                <input
                  type="checkbox"
                  aria-label="Select all customers on this page"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="size-4 cursor-pointer accent-accent"
                />
              </th>
              <th scope="col" className="px-4 py-3">
                Company &amp; Tier
              </th>
              <th scope="col" className="px-4 py-3">
                Key Contact
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Last Activity
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Total Sales
              </th>
              <th scope="col" className="py-3 pr-6 pl-4 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="text-body-md text-ink">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon="person_search"
                    title="No customers match these filters"
                    description="Try a different search term or clear the filters."
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(row.href, { scroll: false })}
                  className="h-16 cursor-pointer border-t border-line-soft transition-colors hover:bg-surface-container-low"
                >
                  <td className="py-3 pl-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.company}`}
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      className="size-4 cursor-pointer accent-accent"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CompanyTile company={row.company} tier={row.tier} status={row.status} />
                      <div>
                        <Link
                          href={row.href}
                          scroll={false}
                          onClick={(e) => e.stopPropagation()}
                          className="block text-headline-sm text-ink hover:text-accent"
                        >
                          {row.company}
                        </Link>
                        <span className="mt-0.5 inline-block">
                          <TierTag tier={row.tier} />
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-label-md text-ink">{row.contactName}</span>
                      <span className="text-body-sm text-ink-subtle">{row.contactEmail}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <CustomerStatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-body-sm whitespace-nowrap text-ink-subtle">{row.lastActivity}</td>
                  <td className="tabular px-4 py-3 text-right text-data-tabular font-medium text-ink">{row.totalSales}</td>
                  <td className="py-3 pr-6 pl-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Link href={row.href} scroll={false} title="View" aria-label={`View ${row.company}`} className={`${iconButton} hover:text-accent`}>
                        <Icon name="visibility" size={18} />
                      </Link>
                      <button type="button" disabled title="Editing is coming soon" aria-label="Edit (coming soon)" className={`${iconButton} disabled:opacity-40`}>
                        <Icon name="edit" size={18} />
                      </button>
                      <button type="button" disabled title="More actions are coming soon" aria-label="More actions (coming soon)" className={`${iconButton} disabled:opacity-40`}>
                        <Icon name="more_vert" size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {selected.size > 0 ? (
        <p className="border-t border-line-soft px-space-md py-space-sm text-body-sm text-ink-subtle" aria-live="polite">
          {selected.size} selected on this page
        </p>
      ) : null}
      {footer}
    </div>
  );
}
