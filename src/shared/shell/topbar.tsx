import { Avatar } from "@/shared/ui/avatar";
import { Icon } from "@/shared/ui/icon";
import { CreateNewMenu } from "./create-new-menu";
import { Logo } from "./logo";
import { CURRENT_USER, WORKSPACE } from "./navigation";

export function Topbar() {
  return (
    <header className="fixed top-0 right-0 left-0 z-40 h-topbar border-b border-line bg-card/90 backdrop-blur-xl md:left-rail lg:left-sidebar">
      <div className="flex h-full items-center justify-between gap-space-md px-space-md md:px-space-lg">
        <div className="flex min-w-0 items-center gap-space-sm">
          <span className="md:hidden">
            <Logo size={28} />
          </span>
          <nav aria-label="Breadcrumb" className="hidden items-center gap-space-sm sm:flex">
            <span className="text-label-md text-ink-subtle">Workspace</span>
            <span className="text-body-sm text-outline">/</span>
            <span className="truncate text-headline-sm text-ink">{WORKSPACE.breadcrumb}</span>
          </nav>
        </div>
        <div className="hidden max-w-md flex-1 md:block">
          <label className="relative flex w-full items-center">
            <span className="sr-only">Search workspace</span>
            <Icon name="search" size={18} className="pointer-events-none absolute left-space-sm text-outline" />
            <input
              type="search"
              placeholder="Search workspace, orders, clients..."
              className="h-[38px] w-full rounded-control bg-surface-container-low pr-12 pl-9 text-body-sm text-ink transition-all placeholder:text-ink-placeholder focus:bg-card focus:shadow-focus focus:outline-none"
            />
            <kbd className="absolute right-space-sm rounded-sm bg-surface-container px-1.5 py-0.5 text-[10px] text-outline">⌘K</kbd>
          </label>
        </div>
        <div className="flex items-center gap-space-sm md:gap-space-md">
          <button
            type="button"
            title="Notifications"
            className="relative rounded-control p-space-xs text-ink-muted transition-colors hover:bg-well hover:text-ink"
          >
            <Icon name="notifications" size={20} />
            <span className="absolute top-1 right-1 size-2 rounded-full bg-accent ring-2 ring-card" aria-hidden />
            <span className="sr-only">You have unread notifications</span>
          </button>
          <CreateNewMenu />
          <Avatar name={CURRENT_USER.name} />
        </div>
      </div>
    </header>
  );
}
