import { signOutAction } from "@/modules/auth/ui/actions";
import { switchWorkspaceAction } from "@/modules/workspaces/ui/actions";
import { listMyWorkspaces } from "@/modules/workspaces/ui/queries";
import { requireRequestContext } from "@/server/request-context";
import { Avatar } from "@/shared/ui/avatar";
import { Icon } from "@/shared/ui/icon";

/**
 * Session-aware pieces of the shell. They read the request context (cookies + database session),
 * so the shell renders them inside `<Suspense>` boundaries.
 */

/** Sidebar workspace card with a simple switcher menu (no-JS `<details>` + Server Action forms). */
export async function WorkspaceSwitcher() {
  const workspaces = await listMyWorkspaces();
  const active = workspaces.find((w) => w.active)!;
  return (
    <details className="group relative hidden lg:block">
      <summary className="flex w-full cursor-pointer list-none items-center justify-between rounded-control bg-surface-container-low p-space-sm text-left transition-colors hover:bg-surface-container [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-col pr-space-xs">
          <span className="truncate text-label-md text-ink">{active.name}</span>
          <span className="truncate text-body-sm text-ink-subtle">{active.tagline || active.roleLabel}</span>
        </span>
        <Icon name="unfold_more" size={18} className="text-outline" />
        <span className="sr-only">Switch workspace</span>
      </summary>
      <div className="absolute inset-x-0 top-full z-10 mt-space-xs rounded-card border border-line bg-card p-space-xs shadow-level-2">
        <p className="px-space-sm py-space-xs text-label-sm tracking-wider text-ink-subtle uppercase">Your workspaces</p>
        <ul>
          {workspaces.map((w) => (
            <li key={w.id}>
              <form action={switchWorkspaceAction}>
                <input type="hidden" name="workspaceId" value={w.id} />
                <button
                  type="submit"
                  aria-current={w.active ? "true" : undefined}
                  className="flex w-full items-center gap-space-sm rounded-control px-space-sm py-space-xs text-left transition-colors hover:bg-surface-container-low"
                >
                  <Avatar name={w.name} size="sm" square />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-label-md text-ink">{w.name}</span>
                    <span className="truncate text-body-sm text-ink-subtle">{w.roleLabel}</span>
                  </span>
                  {w.active ? <Icon name="check" size={18} className="text-accent" /> : null}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export function WorkspaceSwitcherSkeleton() {
  return <div className="hidden h-[58px] animate-pulse rounded-control bg-surface-container-low lg:block" aria-hidden />;
}

/** Sidebar footer: signed-in member and the log out button. */
export async function SidebarUserCard() {
  const { member } = await requireRequestContext();
  return (
    <div className="flex items-center justify-center rounded-control bg-surface-container-low p-space-sm lg:justify-between">
      <div className="flex min-w-0 items-center gap-space-sm">
        <Avatar name={member.name} />
        <div className="hidden min-w-0 flex-col lg:flex">
          <span className="truncate text-label-md text-ink">{member.name}</span>
          <span className="truncate text-body-sm text-ink-subtle">{member.role}</span>
        </div>
      </div>
      <form action={signOutAction} className="hidden lg:block">
        <button type="submit" title="Log out" className="rounded-sm p-space-xs text-outline transition-colors hover:text-danger">
          <Icon name="logout" size={18} />
          <span className="sr-only">Log out</span>
        </button>
      </form>
    </div>
  );
}

export function SidebarUserCardSkeleton() {
  return <div className="h-[56px] animate-pulse rounded-control bg-surface-container-low" aria-hidden />;
}

export async function WorkspaceBreadcrumb() {
  const { workspace } = await requireRequestContext();
  return <span className="truncate text-headline-sm text-ink">{workspace.name}</span>;
}

/** Topbar avatar of the signed-in member (sign out lives in the sidebar card and the mobile "More" sheet). */
export async function TopbarUser() {
  const { member, workspace } = await requireRequestContext();
  return (
    <span title={`${member.name} · ${workspace.name}`}>
      <Avatar name={member.name} />
    </span>
  );
}
