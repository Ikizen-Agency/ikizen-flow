"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui/icon";
import { isActive, type NavItem } from "./navigation";

/** Sidebar link markup. Labels hide on the tablet icon rail (md) and show on desktop (lg). */
export function SidebarNavLinkView({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "flex items-center justify-center gap-space-sm rounded-control px-space-sm py-space-sm transition-colors lg:justify-start",
        active
          ? "bg-accent text-label-md text-white shadow-level-1"
          : "text-body-md text-ink-muted hover:bg-well hover:text-ink",
      )}
    >
      <Icon name={item.icon} size={20} filled={active} />
      <span className="hidden lg:inline">{item.label}</span>
    </Link>
  );
}

/**
 * Sidebar link highlighted for the current route. Reading the pathname suspends on routes with dynamic params
 * (e.g. `/invoices/[number]`), so render it inside `<Suspense>` with `SidebarNavLinkView` as the fallback.
 */
export function SidebarNavLink({ item }: { item: NavItem }) {
  return <SidebarNavLinkView item={item} active={isActive(usePathname(), item.href)} />;
}
