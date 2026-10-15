import Link from "next/link";
import { Avatar } from "@/shared/ui/avatar";
import { Icon } from "@/shared/ui/icon";
import { Logo } from "./logo";
import { SidebarNavLink } from "./nav-link";
import { CURRENT_USER, NAV_ITEMS, WORKSPACE } from "./navigation";

/**
 * Fixed workspace navigation.
 * Desktop (>= 1200px): 256px sidebar with labels. Tablet: 72px icon rail. Mobile: hidden (see MobileNav).
 */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-rail flex-col justify-between border-r border-line bg-card md:flex lg:w-sidebar">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="p-space-md pb-space-sm">
          <Link href="/" className="mb-space-md flex items-center justify-center gap-space-sm lg:justify-start">
            <Logo />
            <span className="hidden text-headline-sm text-ink lg:inline">Ikizen Flow</span>
          </Link>
          <button
            type="button"
            className="hidden w-full items-center justify-between rounded-control bg-surface-container-low p-space-sm text-left transition-colors hover:bg-surface-container lg:flex"
          >
            <span className="flex min-w-0 flex-col pr-space-xs">
              <span className="truncate text-label-md text-ink">{WORKSPACE.name}</span>
              <span className="truncate text-body-sm text-ink-subtle">{WORKSPACE.unit}</span>
            </span>
            <Icon name="unfold_more" size={18} className="text-outline" />
          </button>
        </div>
        <nav aria-label="Primary" className="flex-1 space-y-space-xs overflow-y-auto px-space-md py-space-xs">
          {NAV_ITEMS.map((item) => (
            <SidebarNavLink key={item.href} item={item} />
          ))}
        </nav>
      </div>
      <div className="space-y-space-sm p-space-md">
        <a
          href="https://nextjs.org/docs"
          target="_blank"
          rel="noreferrer"
          title="Documentation & Support"
          className="flex items-center justify-center gap-space-sm rounded-control px-space-sm py-space-xs text-label-md text-ink-muted transition-colors hover:bg-well hover:text-ink lg:justify-start"
        >
          <Icon name="help_outline" size={18} />
          <span className="hidden lg:inline">Documentation &amp; Support</span>
        </a>
        <div className="flex items-center justify-center rounded-control bg-surface-container-low p-space-sm lg:justify-between">
          <div className="flex min-w-0 items-center gap-space-sm">
            <Avatar name={CURRENT_USER.name} />
            <div className="hidden min-w-0 flex-col lg:flex">
              <span className="truncate text-label-md text-ink">{CURRENT_USER.name}</span>
              <span className="truncate text-body-sm text-ink-subtle">{CURRENT_USER.role}</span>
            </div>
          </div>
          <div className="hidden items-center gap-space-xs lg:flex">
            <button type="button" title="Switch workspace" className="rounded-sm p-space-xs text-outline transition-colors hover:text-ink">
              <Icon name="swap_horiz" size={18} />
            </button>
            <button type="button" title="Log out" className="rounded-sm p-space-xs text-outline transition-colors hover:text-danger">
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
