"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { hrefWith, type QueryValue } from "@/shared/ui/href";
import { Icon } from "@/shared/ui/icon";

export interface FilterOption {
  value: string;
  label: string;
}

export interface CustomerFiltersProps {
  /** Current filter params as they appear in the URL. */
  current: { q?: string; status?: string; tier?: string; sort?: string };
  statusOptions: ReadonlyArray<FilterOption>;
  tierOptions: ReadonlyArray<FilterOption>;
  sortOptions: ReadonlyArray<FilterOption>;
}

const SEARCH_DEBOUNCE_MS = 300;

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-1 rounded-control bg-surface-container-low px-2 py-1">
      <span className="pl-1 text-label-sm text-ink-subtle">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer bg-transparent py-1 pr-2 text-label-sm text-ink focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}

/** Search + filter strip. Every change is written to the URL so filtering happens on the server. */
export function CustomerFilters({ current, statusOptions, tierOptions, sortOptions }: CustomerFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(current.q ?? "");

  const navigate = (updates: Record<string, QueryValue>) =>
    startTransition(() => router.replace(hrefWith(pathname, current, { ...updates, page: undefined }), { scroll: false }));

  useEffect(() => {
    if (search.trim() === (current.q ?? "")) return;
    const timer = setTimeout(() => navigate({ q: search.trim() }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navigate is recreated every render; debounce only on input.
  }, [search]);

  return (
    <div className={cn("rounded-card border border-line bg-card p-space-md shadow-level-1", pending && "opacity-80")}>
      <div className="flex flex-col items-center justify-between gap-space-md lg:flex-row">
        <form
          role="search"
          className="relative w-full lg:max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ q: search.trim() });
          }}
        >
          <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-outline" />
          <input
            type="search"
            name="q"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client name, email, or company..."
            aria-label="Search customers"
            className="h-[38px] w-full rounded-control bg-surface-container-low pr-4 pl-10 text-body-sm text-ink transition-all placeholder:text-ink-placeholder focus:bg-card focus:shadow-focus focus:outline-none"
          />
        </form>
        <div className="flex w-full flex-wrap items-center gap-space-sm lg:w-auto">
          <FilterSelect label="Status" value={current.status ?? ""} onChange={(status) => navigate({ status })}>
            <option value="">All Statuses</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Tier" value={current.tier ?? ""} onChange={(tier) => navigate({ tier })}>
            <option value="">All Tiers</option>
            {tierOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Sort" value={current.sort ?? sortOptions[0]?.value ?? ""} onChange={(sort) => navigate({ sort })}>
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>
          <button
            type="button"
            title="Clear Filters"
            aria-label="Clear filters"
            onClick={() => {
              setSearch("");
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
            className="rounded-control p-2 text-outline transition-colors hover:bg-surface-container-low hover:text-ink"
          >
            <Icon name="restart_alt" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
