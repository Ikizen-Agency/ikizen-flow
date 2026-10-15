import Link from "next/link";
import { connection } from "next/server";
import { directory } from "@/server/container";
import { getWorkspaceApp } from "@/server/request-context";
import { Card, CardHeader } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
import { PageHeader } from "@/shared/ui/page-header";
import { ContactSupportForm } from "./components/contact-support-form";

const GETTING_STARTED = [
  { icon: "person_add", title: "Add your customers", body: "Create customer profiles with their contact, tier and payment terms.", href: "/customers?create=1" },
  { icon: "request_quote", title: "Create a sale", body: "Compose a work order with line items, then confirm it to issue the invoice.", href: "/sales?create=1" },
  { icon: "add_task", title: "Plan the work", body: "Track delivery on the kanban board and assign tasks to teammates.", href: "/tasks?create=1" },
  { icon: "dashboard", title: "Watch the overview", body: "Revenue, receivables and the work that needs attention, from live data.", href: "/" },
] as const;

const SHORTCUTS = [
  { keys: ["⌘", "K"], alt: ["Ctrl", "K"], action: "Open search and commands" },
  { keys: ["↑", "↓"], action: "Move through search results" },
  { keys: ["Enter"], action: "Open the highlighted result" },
  { keys: ["Esc"], action: "Close dialogs, menus and panels" },
  { keys: ["⌘", "Enter"], alt: ["Ctrl", "Enter"], action: "Post a task comment" },
] as const;

const GUIDES = [
  {
    icon: "group",
    title: "Customers",
    href: "/customers",
    points: [
      "Search by company or contact and filter by status and tier; the URL keeps your filters.",
      "Open a customer to see lifetime value, open deals, health and recent orders.",
      "Export the filtered directory as CSV.",
    ],
  },
  {
    icon: "trending_up",
    title: "Sales",
    href: "/sales",
    points: [
      "Orders move Draft → Pending → Processing → Invoiced → Completed (or Cancelled).",
      "Overdue is derived from the due date of invoiced orders; it is never set by hand.",
      "The creator of an order is notified when someone else changes its status.",
    ],
  },
  {
    icon: "check_box",
    title: "Tasks",
    href: "/tasks",
    points: [
      "Drag cards between columns or use the Move to menu on each card (keyboard friendly).",
      "Blocked tasks keep a reason; overdue and due-today tasks count as requiring attention.",
      "Assigning a task to a teammate sends them a notification.",
    ],
  },
  {
    icon: "notifications",
    title: "Notifications & email",
    href: "/",
    points: [
      "The bell shows unread notifications first; opening one marks it read and takes you there.",
      "Every email (reminders, invoices, support) is recorded in the workspace outbox.",
      "Without SMTP configured, emails are recorded but not delivered.",
    ],
  },
  {
    icon: "swap_horiz",
    title: "Workspaces",
    href: "/",
    points: [
      "Each workspace keeps its own customers, sales, tasks and notifications.",
      "Switch or create workspaces from the workspace card at the top of the sidebar.",
      "Creating a workspace makes you its owner.",
    ],
  },
] as const;

const FAQ = [
  {
    q: "Why does an invoice show as overdue?",
    a: "An invoiced order becomes overdue the day after its due date (issue date plus payment terms) until it is marked completed. Use Send Reminder on the overview to record a reminder.",
  },
  {
    q: "Who can see my data?",
    a: "Only members of the active workspace. Search, notifications and every list are scoped to the workspace you are working in.",
  },
  {
    q: "Are emails really sent?",
    a: "Only when the server has SMTP configured (SMTP_HOST). Otherwise each email is stored in the outbox with the status Logged so you can review what would have been sent.",
  },
  {
    q: "How do I change my profile or password?",
    a: "Open the avatar menu in the top bar and choose Profile & settings.",
  },
] as const;

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded-sm border border-line bg-surface-container-low px-1.5 py-0.5 text-label-sm text-ink-muted">{children}</kbd>;
}

/** In-app documentation and support (static guides plus the contact form). */
export async function HelpCenter() {
  await connection();
  const { ctx } = await getWorkspaceApp("/help");

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader eyebrow="Documentation & Support" title="Help Center" description="Learn how Ikizen Flow works, find keyboard shortcuts and get in touch with our team." />

      <section aria-labelledby="getting-started" className="flex flex-col gap-space-sm">
        <h2 id="getting-started" className="text-headline-sm text-ink">
          Getting started
        </h2>
        <ol className="grid gap-space-md sm:grid-cols-2 xl:grid-cols-4">
          {GETTING_STARTED.map((step, i) => (
            <li key={step.title}>
              <Link href={step.href} className="flex h-full flex-col gap-space-xs rounded-card border border-line bg-card p-5 shadow-level-1 transition-colors hover:border-line-strong">
                <span className="flex items-center gap-space-sm">
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent-tint text-accent">
                    <Icon name={step.icon} size={18} />
                  </span>
                  <span className="text-label-sm text-ink-subtle">Step {i + 1}</span>
                </span>
                <span className="text-label-md text-ink">{step.title}</span>
                <span className="text-body-sm text-ink-muted">{step.body}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-space-lg lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-space-lg">
          <Card aria-labelledby="guides">
            <CardHeader title={<span id="guides">Module guides</span>} description="What each area of the workspace does." />
            <div className="mt-space-md grid gap-space-md md:grid-cols-2">
              {GUIDES.map((g) => (
                <article key={g.title} className="rounded-control border border-line-soft p-space-md">
                  <Link href={g.href} className="flex items-center gap-space-sm text-label-md text-ink hover:text-accent">
                    <Icon name={g.icon} size={18} className="text-accent" />
                    {g.title}
                  </Link>
                  <ul className="mt-space-xs list-disc space-y-1 pl-5 text-body-sm text-ink-muted">
                    {g.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </Card>

          <Card aria-labelledby="faq">
            <CardHeader title={<span id="faq">Frequently asked questions</span>} />
            <div className="mt-space-sm divide-y divide-line">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-space-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-space-sm text-label-md text-ink [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <Icon name="expand_more" size={18} className="text-outline transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-space-xs text-body-sm text-ink-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-space-lg">
          <Card aria-labelledby="shortcuts">
            <CardHeader title={<span id="shortcuts">Keyboard shortcuts</span>} />
            <dl className="mt-space-sm divide-y divide-line">
              {SHORTCUTS.map((s) => (
                <div key={s.action} className="flex items-center justify-between gap-space-sm py-space-xs">
                  <dt className="text-body-sm text-ink-muted">{s.action}</dt>
                  <dd className="flex shrink-0 items-center gap-1">
                    {s.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                    {"alt" in s ? (
                      <>
                        <span className="px-1 text-body-sm text-outline">or</span>
                        {s.alt.map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card aria-labelledby="contact-title" id="contact">
            <CardHeader title={<span id="contact-title">Contact support</span>} description={`Messages go to ${directory.supportEmail}.`} />
            <div className="mt-space-md">
              <ContactSupportForm replyTo={ctx.user.email} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function HelpCenterSkeleton() {
  return (
    <div className="flex flex-col gap-space-lg" aria-hidden>
      <div className="h-16 w-72 animate-pulse rounded-card bg-surface-container-low" />
      <div className="grid gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-card bg-surface-container-low" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-card bg-surface-container-low" />
    </div>
  );
}
