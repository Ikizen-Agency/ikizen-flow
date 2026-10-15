"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { buttonClasses } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

export interface PeriodPickerProps {
  label: string;
  options: ReadonlyArray<{ label: string; href: string; active: boolean }>;
}

/** Date-range button with a level-2 menu of periods; each option is a URL so the dashboard re-aggregates on the server. */
export function PeriodPicker({ label, options }: PeriodPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
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
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={buttonClasses({ variant: "secondary" })}>
        <Icon name="calendar_today" size={18} />
        <span>{label}</span>
        <Icon name="expand_more" size={18} />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-56 rounded-card border border-line bg-card p-1 shadow-level-2">
          {options.map((o) => (
            <Link
              key={o.href}
              href={o.href}
              role="menuitemradio"
              aria-checked={o.active}
              scroll={false}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center justify-between rounded-control px-space-sm py-2 text-body-sm hover:bg-surface-container-low",
                o.active ? "text-accent" : "text-ink",
              )}
            >
              {o.label}
              {o.active ? <Icon name="check" size={16} /> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
