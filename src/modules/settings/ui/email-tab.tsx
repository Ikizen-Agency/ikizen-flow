import Link from "next/link";
import type { WorkspaceApp } from "@/server/container";
import type { RequestContext } from "@/server/request-context";
import { formatDate, formatRelativeTime } from "@/shared/domain/time";
import { cn } from "@/shared/lib/cn";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { buttonClasses } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { hrefWith } from "@/shared/ui/href";
import { Icon } from "@/shared/ui/icon";
import { Field, Select } from "@/shared/ui/input";
import { Pagination } from "@/shared/ui/pagination";
import { EMAIL_KIND_LABELS, EMAIL_KINDS, EMAIL_STATUS_LABELS, EMAIL_STATUSES, type EmailStatus } from "../../mail/domain/email";
import { can } from "../../workspaces/domain/permissions";
import { retryEmailAction, sendTestEmailAction } from "./actions";
import { ActionButton } from "./components/action-form";
import type { SettingsParams } from "./settings-params";

const PATH = "/settings";

const STATUS_TONE: Record<EmailStatus, BadgeTone> = { queued: "warning", sent: "success", failed: "danger", logged: "neutral" };

const dateTime = (d: Date) => `${formatDate(d)} ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC`;

/** Transport status, test email and the workspace outbox (owners and admins; the use cases enforce it). */
export async function EmailTab({ ctx, app, params }: { ctx: RequestContext; app: WorkspaceApp; params: SettingsParams }) {
  if (!can(ctx.role, "mail.manage")) {
    return (
      <Card>
        <EmptyState icon="lock" title="Email settings are restricted" description="Only owners and admins can see the transport status and the workspace outbox, because it contains customer emails." />
      </Card>
    );
  }
  const actor = { memberId: ctx.member.id, role: ctx.role };
  const { outbox: filters, emailId } = params;
  const [page, selected] = await Promise.all([app.mail.outbox(actor, filters), emailId ? app.mail.get(actor, emailId) : Promise.resolve(null)]);
  const config = app.mail.config;
  const now = new Date();
  const urlState = { tab: "email", kind: filters.kind, status: filters.status, page: filters.page > 1 ? filters.page : undefined };

  return (
    <div className="flex flex-col gap-gutter">
      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
        <Card className="flex flex-col gap-space-md lg:col-span-8" aria-labelledby="transport-title">
          <div className="flex items-start justify-between gap-space-md">
            <div>
              <h2 id="transport-title" className="text-headline-sm text-ink">
                Delivery transport
              </h2>
              <p className="text-body-sm text-ink-subtle">
                {config.transport === "smtp"
                  ? "Emails are delivered through your SMTP server and recorded in the outbox."
                  : "SMTP is not configured (SMTP_HOST is unset): emails are only recorded in the outbox with status Logged."}
              </p>
            </div>
            <Badge tone={config.transport === "smtp" ? "success" : "warning"} dot>
              {config.transport === "smtp" ? "SMTP" : "Log only"}
            </Badge>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-space-md gap-y-space-xs text-body-sm">
            <dt className="text-ink-subtle">From address</dt>
            <dd className="break-all text-ink">{config.from}</dd>
            {config.host ? (
              <>
                <dt className="text-ink-subtle">SMTP server</dt>
                <dd className="text-ink">
                  {config.host}:{config.port} {config.secure ? "(TLS)" : "(STARTTLS when offered)"}
                </dd>
              </>
            ) : null}
          </dl>
        </Card>
        <Card className="flex flex-col gap-space-md lg:col-span-4">
          <CardHeader title="Send a test email" description={`Sends a short message to ${ctx.user.email} and records the outcome.`} />
          <ActionButton action={sendTestEmailAction} label="Send test email" pendingLabel="Sending..." icon="send" variant="primary" className="items-start" />
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-12">
        <Card flush className={cn(selected ? "lg:col-span-7" : "lg:col-span-12")} aria-labelledby="outbox-title">
          <div className="flex flex-col gap-space-md p-5">
            <h2 id="outbox-title" className="text-headline-sm text-ink">
              Outbox ({page.total})
            </h2>
            <form action={PATH} className="grid grid-cols-1 gap-space-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <input type="hidden" name="tab" value="email" />
              <Field label="Kind" htmlFor="outbox-kind">
                <Select id="outbox-kind" name="kind" defaultValue={filters.kind ?? ""}>
                  <option value="">All kinds</option>
                  {EMAIL_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {EMAIL_KIND_LABELS[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status" htmlFor="outbox-status">
                <Select id="outbox-status" name="status" defaultValue={filters.status ?? ""}>
                  <option value="">All statuses</option>
                  {EMAIL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {EMAIL_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex gap-space-sm">
                <button type="submit" className={buttonClasses({ variant: "secondary" })}>
                  <Icon name="filter_list" size={18} />
                  Apply
                </button>
                {filters.kind || filters.status ? (
                  <Link href={hrefWith(PATH, { tab: "email" })} className={buttonClasses({ variant: "ghost" })}>
                    Clear
                  </Link>
                ) : null}
              </div>
            </form>
          </div>
          {page.items.length === 0 ? (
            <p className="border-t border-line px-5 py-space-lg text-center text-body-sm text-ink-subtle">No emails match these filters.</p>
          ) : (
            <ul className="divide-y divide-line-soft border-t border-line">
              {page.items.map((e) => (
                <li key={e.id}>
                  <Link
                    href={hrefWith(PATH, urlState, { email: e.id })}
                    scroll={false}
                    aria-current={selected?.id === e.id ? "true" : undefined}
                    className={cn("flex items-start justify-between gap-space-md px-5 py-space-sm transition-colors hover:bg-canvas", selected?.id === e.id && "bg-accent-tint")}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-label-md text-ink">{e.subject}</p>
                      <p className="truncate text-body-sm text-ink-subtle">
                        {EMAIL_KIND_LABELS[e.kind]} · to {e.to} · {formatRelativeTime(e.createdAt, now)}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[e.status]}>{EMAIL_STATUS_LABELS[e.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Pagination className="border-t border-line px-5 py-space-sm" page={page.page} pageSize={page.pageSize} total={page.total} hrefFor={(p) => hrefWith(PATH, urlState, { page: p > 1 ? p : undefined })} />
        </Card>

        {selected ? (
          <Card className="flex flex-col gap-space-md lg:col-span-5" aria-labelledby="email-detail-title">
            <div className="flex items-start justify-between gap-space-sm">
              <h2 id="email-detail-title" className="text-headline-sm break-words text-ink">
                {selected.subject}
              </h2>
              <Link href={hrefWith(PATH, urlState)} scroll={false} aria-label="Close email" className="rounded-control p-1 text-ink-subtle hover:bg-well hover:text-ink">
                <Icon name="close" size={18} />
              </Link>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-space-md gap-y-space-xs text-body-sm">
              <dt className="text-ink-subtle">To</dt>
              <dd className="break-all text-ink">{selected.to}</dd>
              <dt className="text-ink-subtle">Kind</dt>
              <dd className="text-ink">{EMAIL_KIND_LABELS[selected.kind]}</dd>
              <dt className="text-ink-subtle">Status</dt>
              <dd>
                <Badge tone={STATUS_TONE[selected.status]}>{EMAIL_STATUS_LABELS[selected.status]}</Badge>
              </dd>
              <dt className="text-ink-subtle">Created</dt>
              <dd className="text-ink">{dateTime(selected.createdAt)}</dd>
              {selected.sentAt ? (
                <>
                  <dt className="text-ink-subtle">Delivered</dt>
                  <dd className="text-ink">{dateTime(selected.sentAt)}</dd>
                </>
              ) : null}
            </dl>
            {selected.error ? (
              <p role="alert" className="rounded-control border border-danger-line bg-danger-tint p-space-sm text-body-sm break-words text-danger-strong">
                {selected.error}
              </p>
            ) : null}
            <pre className="max-h-96 overflow-auto rounded-control bg-surface-container-low p-space-sm font-sans text-body-sm whitespace-pre-wrap text-ink">{selected.text}</pre>
            {selected.status === "failed" ? <ActionButton action={retryEmailAction} label="Retry delivery" pendingLabel="Retrying..." icon="refresh" fields={{ emailId: selected.id }} /> : null}
          </Card>
        ) : emailId ? (
          <Card className="lg:col-span-5">
            <p className="text-body-sm text-ink-subtle">This email does not exist in this workspace.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
