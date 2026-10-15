"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Avatar } from "@/shared/ui/avatar";
import { hrefWith, type QueryValue } from "@/shared/ui/href";
import { Icon } from "@/shared/ui/icon";

interface Option {
  value: string;
  label: string;
}

export interface TaskFiltersProps {
  /** Current filter params as they appear in the URL (view included so it survives filtering). */
  current: Record<string, QueryValue>;
  members: ReadonlyArray<{ id: number; name: string }>;
  priorityOptions: ReadonlyArray<Option>;
  clientOptions: ReadonlyArray<Option>;
  dueOptions: ReadonlyArray<Option>;
  criticalBlockers: number;
}

function FilterSelect({ icon, label, value, onChange, children }: { icon: string; label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="flex items-center gap-1 rounded-control bg-surface-container-low px-2 py-1">
      <Icon name={icon} size={16} className="text-ink-subtle" />
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer bg-transparent py-1 pr-1 text-label-sm text-ink focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}

const SEARCH_DEBOUNCE_MS = 300;

/** Text search plus assignee / priority / client / due filters. Every change rewrites the URL so the board filters on the server. */
export function TaskFilters({ current, members, priorityOptions, clientOptions, dueOptions, criticalBlockers }: TaskFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const navigate = (updates: Record<string, QueryValue>) =>
    startTransition(() => router.replace(hrefWith(pathname, current, updates), { scroll: false }));

  const selectedAssignee = current.assignee ? Number(current.assignee) : null;
  const currentQuery = String(current.q ?? "");
  const [search, setSearch] = useState(currentQuery);
  /** Set by "Clear filters" so emptying the box does not re-navigate with the stale filters. */
  const cleared = useRef(false);

  useEffect(() => {
    if (cleared.current) {
      cleared.current = false;
      return;
    }
    if (search.trim() === currentQuery) return;
    const timer = setTimeout(() => navigate({ q: search.trim() || undefined }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navigate is recreated every render; debounce only on input.
  }, [search]);

  return (
    <div className={cn("rounded-card border border-line bg-card p-space-md shadow-level-1", pending && "opacity-80")}>
      <div className="flex flex-wrap items-center gap-space-md">
        <form
          role="search"
          className="relative w-full md:w-64"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ q: search.trim() || undefined });
          }}
        >
          <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-outline" />
          <input
            type="search"
            name="q"
            value={search}
            maxLength={80}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks, codes, descriptions..."
            aria-label="Search tasks"
            className="h-[34px] w-full rounded-control bg-surface-container-low pr-3 pl-10 text-body-sm text-ink transition-all placeholder:text-ink-placeholder focus:bg-card focus:shadow-focus focus:outline-none"
          />
        </form>

        <div className="flex items-center gap-space-sm">
          <span className="text-label-sm tracking-[0.08em] text-ink-subtle uppercase">Assignees</span>
          <div className="flex -space-x-1.5" role="group" aria-label="Filter by assignee">
            {members.map((m) => {
              const active = selectedAssignee === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  title={`Filter by ${m.name}`}
                  aria-pressed={active}
                  onClick={() => navigate({ assignee: active ? undefined : m.id })}
                  className={cn(
                    "rounded-full ring-2 ring-card transition-transform hover:z-10 hover:-translate-y-0.5 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-accent",
                    active && "z-10 ring-accent",
                    selectedAssignee !== null && !active && "opacity-50",
                  )}
                >
                  <Avatar name={m.name} size="sm" />
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => navigate({ assignee: undefined })}
            aria-pressed={selectedAssignee === null}
            className={cn("text-label-sm hover:text-ink", selectedAssignee === null ? "text-ink" : "text-ink-subtle")}
          >
            All Members
          </button>
        </div>

        <span className="hidden h-6 w-px bg-line md:block" aria-hidden />

        <div className="flex flex-wrap items-center gap-space-sm">
          <FilterSelect icon="flag" label="Priority" value={String(current.priority ?? "")} onChange={(priority) => navigate({ priority })}>
            <option value="">All Priorities</option>
            {priorityOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect icon="domain" label="Client" value={String(current.client ?? "")} onChange={(client) => navigate({ client })}>
            <option value="">All Clients &amp; Workspaces</option>
            {clientOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect icon="calendar_today" label="Due date" value={String(current.due ?? "")} onChange={(due) => navigate({ due })}>
            <option value="">Due: Any Time</option>
            {dueOptions.map((o) => (
              <option key={o.value} value={o.value}>
                Due: {o.label}
              </option>
            ))}
          </FilterSelect>
        </div>

        <div className="flex items-center gap-space-sm lg:ml-auto">
          {criticalBlockers > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-badge border border-danger-line bg-danger-tint px-2 py-0.5 text-label-sm text-danger-strong">
              <span className="size-1.5 rounded-full bg-danger" aria-hidden />
              {criticalBlockers} Critical Blocker{criticalBlockers === 1 ? "" : "s"}
            </span>
          ) : null}
          <button
            type="button"
            title="Clear Filters"
            aria-label="Clear filters"
            onClick={() => {
              if (search) {
                cleared.current = true;
                setSearch("");
              }
              startTransition(() => router.replace(hrefWith(pathname, { view: current.view }), { scroll: false }));
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
