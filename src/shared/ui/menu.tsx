"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Icon } from "./icon";

export interface MenuProps {
  /** Visible trigger content (icon + label), or an icon-only trigger with `triggerLabel`. */
  trigger: ReactNode;
  /** Accessible name of the trigger. */
  triggerLabel: string;
  triggerClassName?: string;
  align?: "left" | "right";
  className?: string;
  /** Menu items; call `close()` after an item acts. */
  children: (close: () => void) => ReactNode;
}

/** Level 2 popover menu: closes on outside click, Escape and after an item runs. */
export function Menu({ trigger, triggerLabel, triggerClassName, align = "left", className, children }: MenuProps) {
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
    <div ref={ref} className="relative inline-block text-left">
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={triggerLabel} onClick={() => setOpen((v) => !v)} className={triggerClassName}>
        {trigger}
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-30 mt-2 min-w-52 rounded-card border border-line-strong bg-card py-1 shadow-level-2",
            align === "right" ? "right-0" : "left-0",
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export interface MenuItemProps {
  icon: string;
  children: ReactNode;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
}

const itemClass = "flex w-full items-center gap-2 px-4 py-2 text-left text-body-sm transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50";

export function MenuItem({ icon, children, onSelect, href, danger, disabled }: MenuItemProps) {
  const cls = cn(itemClass, danger ? "text-danger" : "text-ink");
  if (href) {
    return (
      <a role="menuitem" href={href} onClick={onSelect} className={cls}>
        <Icon name={icon} size={16} />
        {children}
      </a>
    );
  }
  return (
    <button type="button" role="menuitem" onClick={onSelect} disabled={disabled} className={cls}>
      <Icon name={icon} size={16} />
      {children}
    </button>
  );
}
