import { signOutAction } from "@/modules/auth/ui/actions";
import { WORKSPACE_ROLE_LABELS } from "@/modules/workspaces/domain/workspace";
import { WorkspaceSwitcherMenu } from "@/modules/workspaces/ui/components/workspace-switcher-menu";
import { listMyWorkspaces } from "@/modules/workspaces/ui/queries";
import { requireRequestContext } from "@/server/request-context";
import { Avatar } from "@/shared/ui/avatar";
import { Icon } from "@/shared/ui/icon";
import { Breadcrumb } from "./breadcrumb";
import { UserMenu } from "./user-menu";

/**
 * Session-aware pieces of the shell. They read the request context (cookies + database session),
 * so the shell renders them inside `<Suspense>` boundaries.
 */

/** Sidebar workspace card with the switcher / create workspace menu. */
export async function WorkspaceSwitcher() {
  return <WorkspaceSwitcherMenu workspaces={await listMyWorkspaces()} />;
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
        <Avatar name={member.name} color={member.avatarColor} />
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
  return <Breadcrumb workspaceName={workspace.name} />;
}

export function WorkspaceBreadcrumbSkeleton() {
  return <span className="hidden h-5 w-48 animate-pulse rounded-sm bg-surface-container-low sm:block" aria-hidden />;
}

/** Topbar avatar with the account menu. */
export async function TopbarUser() {
  const { user, member, role, workspace } = await requireRequestContext();
  return (
    <UserMenu
      name={member.name}
      email={user.email}
      title={member.role}
      roleLabel={WORKSPACE_ROLE_LABELS[role]}
      workspaceName={workspace.name}
      avatarColor={member.avatarColor ?? null}
    />
  );
}
