import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "./logo";
import { SidebarNavLink } from "./nav-link";
import { HELP_ITEM, NAV_ITEMS } from "./navigation";
import { SidebarUserCard, SidebarUserCardSkeleton, WorkspaceSwitcher, WorkspaceSwitcherSkeleton } from "./session-widgets";

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
          <Suspense fallback={<WorkspaceSwitcherSkeleton />}>
            <WorkspaceSwitcher />
          </Suspense>
        </div>
        <nav aria-label="Primary" className="flex-1 space-y-space-xs overflow-y-auto px-space-md py-space-xs">
          {NAV_ITEMS.map((item) => (
            <SidebarNavLink key={item.href} item={item} />
          ))}
        </nav>
      </div>
      <div className="space-y-space-sm p-space-md">
        <SidebarNavLink item={{ href: HELP_ITEM.href, label: "Documentation & Support", icon: HELP_ITEM.icon, primaryOnMobile: false }} />
        <Suspense fallback={<SidebarUserCardSkeleton />}>
          <SidebarUserCard />
        </Suspense>
      </div>
    </aside>
  );
}
