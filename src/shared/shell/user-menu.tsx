"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOutAction } from "@/modules/auth/ui/actions";
import { Avatar } from "@/shared/ui/avatar";
import { Icon } from "@/shared/ui/icon";

export interface UserMenuProps {
  name: string;
  email: string;
  /** Job title in the active workspace. */
  title: string;
  /** Access level in the active workspace ("Owner"). */
  roleLabel: string;
  workspaceName: string;
}

const LINKS = [
  { href: "/settings?tab=profile", label: "Profile & settings", icon: "person" },
  { href: "/help", label: "Help & support", icon: "help_outline" },
] as const;

/** Topbar avatar menu: who is signed in, links to profile settings and help, and log out. */
export function UserMenu({ name, email, title, roleLabel, workspaceName }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "flex w-full items-center gap-space-sm rounded-control px-space-sm py-space-sm text-left text-label-md text-ink-muted transition-colors hover:bg-well hover:text-ink focus-visible:bg-well focus-visible:outline-none";

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Avatar name={name} />
        <span className="sr-only">Account menu for {name}</span>
      </button>
      {open ? (
        <div id={menuId} role="menu" aria-label="Account" className="absolute right-0 z-50 mt-2 w-64 rounded-card border border-line-strong bg-card p-1 shadow-level-2">
          <div className="flex items-center gap-space-sm border-b border-line px-space-sm pt-space-xs pb-space-sm">
            <Avatar name={name} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-label-md text-ink">{name}</span>
              <span className="truncate text-body-sm text-ink-subtle">{email}</span>
              <span className="truncate text-body-sm text-ink-subtle">
                {title} · {roleLabel} at {workspaceName}
              </span>
            </div>
          </div>
          <div className="py-1">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
                <Icon name={l.icon} size={18} />
                {l.label}
              </Link>
            ))}
          </div>
          <form action={signOutAction} className="border-t border-line pt-1">
            <button type="submit" role="menuitem" className={`${itemClass} hover:text-danger`}>
              <Icon name="logout" size={18} />
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
