"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

const ACTIONS = [
  { label: "Send Campaign", icon: "mail" },
  { label: "Apply Tier Tag", icon: "label" },
  { label: "Archive Selected", icon: "archive" },
  { label: "Delete Records", icon: "delete", danger: true },
] as const;

/** Bulk actions dropdown. The actions are not wired to the backend yet, so they render disabled. */
export function BulkActionsMenu() {
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
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={buttonClasses({ variant: "secondary" })}
      >
        <Icon name="checklist" size={18} />
        Bulk Actions
        <Icon name="expand_more" size={16} />
      </button>
      {open ? (
        <div role="menu" className="absolute left-0 z-30 mt-2 w-52 rounded-card border border-line-strong bg-card py-1 shadow-level-2">
          {ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              disabled
              title="Coming soon"
              className={`flex w-full items-center gap-2 px-4 py-2 text-left text-body-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                "danger" in a ? "text-danger" : "text-ink"
              }`}
            >
              <Icon name={a.icon} size={16} />
              {a.label}
            </button>
          ))}
          <p className="border-t border-line-soft px-4 pt-2 pb-1 text-body-sm text-ink-subtle">Bulk operations are coming soon.</p>
        </div>
      ) : null}
    </div>
  );
}
