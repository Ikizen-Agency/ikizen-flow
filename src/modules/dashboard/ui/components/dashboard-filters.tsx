"use client";

import Form from "next/form";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { Button, buttonClasses } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Field, Select } from "@/shared/ui/input";

export interface DashboardFiltersProps {
  categories: ReadonlyArray<{ value: string; label: string }>;
  customers: ReadonlyArray<{ id: number; company: string }>;
  members: ReadonlyArray<{ id: number; name: string }>;
  current: { category?: string; customer?: number; assignee?: number };
  /** Params kept when filtering (period, metric). */
  keep: Record<string, string | undefined>;
  activeCount: number;
  clearHref: string;
}

/** Filters popover: a GET form, so the dashboard re-aggregates on the server from URL params. */
export function DashboardFilters({ categories, customers, members, current, keep, activeCount, clearHref }: DashboardFiltersProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={buttonClasses({ variant: "secondary" })}>
        <Icon name="tune" size={18} />
        <span>Filters</span>
        {activeCount > 0 ? <span className="tabular rounded-full bg-accent px-1.5 text-label-sm text-white">{activeCount}</span> : null}
      </button>
      {open ? (
        <div role="dialog" aria-label="Dashboard filters" className="absolute right-0 z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-card border border-line bg-card p-space-md shadow-level-2">
          <Form action="/" scroll={false} onSubmit={() => setOpen(false)} className="flex flex-col gap-space-md">
            {Object.entries(keep).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
            <Field label="Service category" htmlFor="filter-category" hint="Revenue, sales and receivables widgets.">
              <Select id="filter-category" name="category" defaultValue={current.category ?? ""}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Customer" htmlFor="filter-customer" hint="Orders, receivables and tasks of one client.">
              <Select id="filter-customer" name="customer" defaultValue={current.customer ? String(current.customer) : ""}>
                <option value="">All customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assignee" htmlFor="filter-assignee" hint="Critical tasks and the attention tile.">
              <Select id="filter-assignee" name="assignee" defaultValue={current.assignee ? String(current.assignee) : ""}>
                <option value="">Everyone</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-center justify-between gap-space-sm">
              <Link href={clearHref} scroll={false} onClick={() => setOpen(false)} className={cn(buttonClasses({ variant: "ghost" }), activeCount === 0 && "invisible")}>
                Clear filters
              </Link>
              <Button type="submit" icon="check">
                Apply
              </Button>
            </div>
          </Form>
        </div>
      ) : null}
    </div>
  );
}
