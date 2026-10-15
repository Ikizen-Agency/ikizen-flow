import Link from "next/link";
import { connection } from "next/server";
import { getWorkspaceApp } from "@/server/request-context";
import { formatDate, formatRelativeTime } from "@/shared/domain/time";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/badge";
import { buttonClasses } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { hrefWith } from "@/shared/ui/href";
import { Icon } from "@/shared/ui/icon";
import { Field, Select } from "@/shared/ui/input";
import { PageHeader } from "@/shared/ui/page-header";
import { Pagination } from "@/shared/ui/pagination";
import type { SearchParamsRecord } from "../../customers/application/list-params";
import { ActivityMessage } from "./activity-message";
import { parseActivityParams } from "../application/params";
import { ACTIVITY_PAGE_SIZE } from "../application/use-cases";
import { ACTIVITY_CATEGORIES, ACTIVITY_CATEGORY_LABELS, ACTIVITY_ENTITY_LABELS, ACTIVITY_ENTITY_TYPES, type ActivityCategory } from "../domain/activity";

const PATH = "/activity";

const DOT: Record<ActivityCategory, string> = {
  billing: "bg-success",
  pipeline: "bg-accent",
  strategy: "bg-tertiary",
  development: "bg-outline",
  operations: "bg-warning",
};

/** Container for /activity: the workspace's full activity log with category, member and record-type filters. */
export async function ActivityFeed({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await connection();
  const query = parseActivityParams(await searchParams);
  const { ctx, app } = await getWorkspaceApp(PATH);
  const [page, members] = await Promise.all([app.activity.list({ ...query, pageSize: ACTIVITY_PAGE_SIZE }), app.team.members()]);
  const now = new Date();
  const urlState = { category: query.category, member: query.actorId, entity: query.entityType };
  const filtered = Boolean(query.category || query.actorId || query.entityType);

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        eyebrow="Audit trail"
        title="Team Activity"
        description={`Everything your team did in ${ctx.workspace.name}, newest first.`}
        meta={<Badge tone="neutral">{page.total} events</Badge>}
      />
      <Card flush aria-labelledby="activity-feed-title">
        <div className="flex flex-col gap-space-md p-5">
          <h2 id="activity-feed-title" className="sr-only">
            Activity feed
          </h2>
          <form action={PATH} role="search" className="grid grid-cols-1 gap-space-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
            <Field label="Category" htmlFor="activity-category">
              <Select id="activity-category" name="category" defaultValue={query.category ?? ""}>
                <option value="">All categories</option>
                {ACTIVITY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {ACTIVITY_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Member" htmlFor="activity-member">
              <Select id="activity-member" name="member" defaultValue={query.actorId ? String(query.actorId) : ""}>
                <option value="">Everyone</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Record type" htmlFor="activity-entity">
              <Select id="activity-entity" name="entity" defaultValue={query.entityType ?? ""}>
                <option value="">All records</option>
                {ACTIVITY_ENTITY_TYPES.map((e) => (
                  <option key={e} value={e}>
                    {ACTIVITY_ENTITY_LABELS[e]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex gap-space-sm">
              <button type="submit" className={buttonClasses({ variant: "secondary" })}>
                <Icon name="filter_list" size={18} />
                Apply
              </button>
              {filtered ? (
                <Link href={PATH} className={buttonClasses({ variant: "ghost" })}>
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
        </div>
        {page.items.length === 0 ? (
          <EmptyState className="border-t border-line" icon="history" title={filtered ? "No activity matches these filters" : "No activity yet"} />
        ) : (
          <ol className="divide-y divide-line-soft border-t border-line">
            {page.items.map((event) => (
              <li key={event.id} className="flex items-start gap-space-sm px-5 py-space-sm">
                <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", DOT[event.category])} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm text-ink">
                    <span className="font-semibold">{event.actorName ?? "System"}</span> <ActivityMessage text={event.message} />
                  </p>
                  <p className="mt-0.5 text-label-sm text-ink-subtle">
                    <time dateTime={event.createdAt.toISOString()} title={formatDate(event.createdAt)}>
                      {formatRelativeTime(event.createdAt, now)}
                    </time>{" "}
                    • {ACTIVITY_CATEGORY_LABELS[event.category]}
                  </p>
                </div>
                {event.href ? (
                  <Link href={event.href} className="shrink-0 text-label-sm text-accent hover:underline">
                    Open
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        <Pagination
          className="border-t border-line px-5 py-space-sm"
          page={page.page}
          pageSize={page.pageSize}
          total={page.total}
          hrefFor={(p) => hrefWith(PATH, urlState, { page: p > 1 ? p : undefined })}
        />
      </Card>
    </div>
  );
}

export function ActivityFeedSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-space-lg" aria-busy="true" aria-label="Loading activity">
      <div className="h-20 rounded-card bg-well" />
      <div className="h-[32rem] rounded-card bg-well" />
    </div>
  );
}
