"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

const ACTIONS = [
  { href: "/customers?create=1", label: "New customer", icon: "person_add" },
  { href: "/sales?create=1", label: "New sale", icon: "request_quote" },
  { href: "/tasks?create=1", label: "New task", icon: "add_task" },
] as const;

/** Topbar "Create New" button with a level-2 dropdown of quick-create shortcuts. */
export function CreateNewMenu() {
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
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={buttonClasses({ variant: "primary", className: "px-space-sm sm:px-space-md" })}
      >
        <Icon name="add" size={18} />
        <span className="hidden sm:inline">Create New</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-52 rounded-card border border-line-strong bg-card p-1 shadow-level-2"
        >
          {ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-space-sm rounded-control px-space-sm py-space-sm text-label-md text-ink-muted hover:bg-well hover:text-ink"
            >
              <Icon name={a.icon} size={18} />
              {a.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
