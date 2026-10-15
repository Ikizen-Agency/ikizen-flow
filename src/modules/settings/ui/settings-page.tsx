import Link from "next/link";
import { connection } from "next/server";
import { getWorkspaceApp } from "@/server/request-context";
import { cn } from "@/shared/lib/cn";
import { hrefWith } from "@/shared/ui/href";
import { Icon } from "@/shared/ui/icon";
import { PageHeader } from "@/shared/ui/page-header";
import type { SearchParamsRecord } from "../../customers/application/list-params";
import { WORKSPACE_ROLE_LABELS } from "../../workspaces/domain/workspace";
import { EmailTab } from "./email-tab";
import { MembersTab } from "./members-tab";
import { NotificationsTab } from "./notifications-tab";
import { ProfileTab } from "./profile-tab";
import { parseSettingsParams, SETTINGS_TAB_LABELS, SETTINGS_TABS } from "./settings-params";
import { WorkspaceTab } from "./workspace-tab";

export const SETTINGS_PATH = "/settings";

/** Container for /settings: tab navigation (`?tab=`) and the selected tab. */
export async function SettingsPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await connection();
  const params = parseSettingsParams(await searchParams);
  const { ctx, app } = await getWorkspaceApp(SETTINGS_PATH);

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description={`Manage ${ctx.workspace.name}, its people, your profile and how Ikizen Flow reaches you. Your access level: ${WORKSPACE_ROLE_LABELS[ctx.role]}.`}
      />
      <nav aria-label="Settings sections" className="flex gap-space-xs overflow-x-auto border-b border-line">
        {SETTINGS_TABS.map((tab) => (
          <Link
            key={tab}
            href={hrefWith(SETTINGS_PATH, { tab })}
            scroll={false}
            aria-current={params.tab === tab ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-space-xs border-b-2 px-space-md py-space-sm text-label-md transition-colors",
              params.tab === tab ? "border-accent text-accent" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            <Icon name={SETTINGS_TAB_LABELS[tab].icon} size={18} />
            {SETTINGS_TAB_LABELS[tab].label}
          </Link>
        ))}
      </nav>
      {params.tab === "workspace" ? <WorkspaceTab ctx={ctx} /> : null}
      {params.tab === "members" ? <MembersTab ctx={ctx} app={app} /> : null}
      {params.tab === "profile" ? <ProfileTab ctx={ctx} /> : null}
      {params.tab === "notifications" ? <NotificationsTab ctx={ctx} app={app} /> : null}
      {params.tab === "email" ? <EmailTab ctx={ctx} app={app} params={params} /> : null}
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-space-lg" aria-busy="true" aria-label="Loading settings">
      <div className="h-20 rounded-card bg-well" />
      <div className="h-10 rounded-card bg-well" />
      <div className="h-80 rounded-card bg-well" />
    </div>
  );
}
