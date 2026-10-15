import { Suspense } from "react";
import { NotificationsMenu, NotificationsMenuSkeleton } from "@/modules/notifications/ui/notifications-menu";
import { CommandPalette } from "@/modules/search/ui/command-palette";
import { CreateNewMenu } from "./create-new-menu";
import { Logo } from "./logo";
import { TopbarUser, WorkspaceBreadcrumb, WorkspaceBreadcrumbSkeleton } from "./session-widgets";

export function Topbar() {
  return (
    <header className="fixed top-0 right-0 left-0 z-40 h-topbar print:hidden border-b border-line bg-card/90 backdrop-blur-xl md:left-rail lg:left-sidebar">
      <div className="flex h-full items-center justify-between gap-space-md px-space-md md:px-space-lg">
        <div className="flex min-w-0 items-center gap-space-sm">
          <span className="md:hidden">
            <Logo size={28} />
          </span>
          <Suspense fallback={<WorkspaceBreadcrumbSkeleton />}>
            <WorkspaceBreadcrumb />
          </Suspense>
        </div>
        <div className="hidden max-w-md flex-1 justify-center md:flex">
          <CommandPalette />
        </div>
        <div className="flex items-center gap-space-sm md:gap-space-md">
          <span className="md:hidden">
            <CommandPalette variant="icon" />
          </span>
          <Suspense fallback={<NotificationsMenuSkeleton />}>
            <NotificationsMenu />
          </Suspense>
          <CreateNewMenu />
          <Suspense fallback={<span className="size-8 animate-pulse rounded-full bg-surface-container-low" aria-hidden />}>
            <TopbarUser />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
