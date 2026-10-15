"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui/icon";
import { SEARCH_MIN_LENGTH } from "../domain/search";

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: string;
  href: string;
}

const QUICK_ACTIONS: PaletteItem[] = [
  { id: "a-customer", group: "Quick actions", label: "Create customer", icon: "person_add", href: "/customers?create=1" },
  { id: "a-sale", group: "Quick actions", label: "Create sale", icon: "request_quote", href: "/sales?create=1" },
  { id: "a-task", group: "Quick actions", label: "Create task", icon: "add_task", href: "/tasks?create=1" },
];

const PAGES: PaletteItem[] = [
  { id: "p-overview", group: "Go to", label: "Overview", icon: "dashboard", href: "/" },
  { id: "p-customers", group: "Go to", label: "Customers", icon: "group", href: "/customers" },
  { id: "p-sales", group: "Go to", label: "Sales", icon: "trending_up", href: "/sales" },
  { id: "p-tasks", group: "Go to", label: "Tasks", icon: "check_box", href: "/tasks" },
  { id: "p-invoices", group: "Go to", label: "Invoices", icon: "receipt_long", href: "/invoices" },
  { id: "p-reports", group: "Go to", label: "Reports", icon: "bar_chart", href: "/reports" },
  { id: "p-activity", group: "Go to", label: "Team activity", icon: "history", href: "/activity" },
  { id: "p-settings", group: "Go to", label: "Settings", icon: "settings", href: "/settings" },
  { id: "p-settings-members", group: "Go to", label: "Settings: Members & invitations", icon: "group_add", href: "/settings?tab=members" },
  { id: "p-settings-profile", group: "Go to", label: "Settings: Profile & password", icon: "person", href: "/settings?tab=profile" },
  { id: "p-settings-notifications", group: "Go to", label: "Settings: Notification preferences", icon: "notifications", href: "/settings?tab=notifications" },
  { id: "p-settings-email", group: "Go to", label: "Settings: Email & outbox", icon: "mail", href: "/settings?tab=email" },
  { id: "p-help", group: "Go to", label: "Help & Support", icon: "help_outline", href: "/help" },
];

interface SearchResponse {
  customers: Array<{ id: number; company: string; contactName: string; href: string }>;
  orders: Array<{ reference: string; title: string; invoiceNumber: string | null; customerCompany: string; href: string }>;
  tasks: Array<{ id: number; code: string; title: string; href: string }>;
}

function toItems(data: SearchResponse): PaletteItem[] {
  return [
    ...data.customers.map((c) => ({ id: `c-${c.id}`, group: "Customers", label: c.company, hint: c.contactName, icon: "apartment", href: c.href })),
    ...data.orders.map((o) => ({
      id: `o-${o.reference}`,
      group: "Orders",
      label: `${o.reference} · ${o.title}`,
      hint: [o.invoiceNumber, o.customerCompany].filter(Boolean).join(" · "),
      icon: "receipt_long",
      href: o.href,
    })),
    ...data.tasks.map((t) => ({ id: `t-${t.id}`, group: "Tasks", label: t.title, hint: t.code, icon: "check_box", href: t.href })),
  ];
}

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Topbar search trigger plus the command palette (workspace search, quick actions, navigation).
 * The "bar" variant also owns the global ⌘K / Ctrl+K shortcut; render exactly one of it.
 */
export function CommandPalette({ variant = "bar" }: { variant?: "bar" | "icon" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaletteItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [active, setActive] = useState(0);
  const [shortcut, setShortcut] = useState("Ctrl K");
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const listId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setStatus("idle");
    triggerRef.current?.focus?.();
  }, []);

  const openPalette = useCallback(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    setActive(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    // Platform-specific hint, resolved after hydration to keep server and client markup identical.
    if (variant !== "bar") return;
    const id = requestAnimationFrame(() => setShortcut(isMac() ? "⌘K" : "Ctrl K"));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else openPalette();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, openPalette, variant]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  // Debounced workspace search; stale requests are aborted.
  const trimmed = query.trim();
  useEffect(() => {
    if (!open || trimmed.length < SEARCH_MIN_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        setResults(toItems((await response.json()) as SearchResponse));
        setStatus("idle");
        setActive(0);
      } catch (error) {
        if (!controller.signal.aborted) {
          setStatus("error");
          console.error(error);
        }
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, trimmed]);

  const items = useMemo(() => {
    const needle = trimmed.toLowerCase();
    const shortcuts = [...QUICK_ACTIONS, ...PAGES].filter((i) => !needle || i.label.toLowerCase().includes(needle));
    return trimmed.length >= SEARCH_MIN_LENGTH ? [...results, ...shortcuts] : shortcuts;
  }, [trimmed, results]);

  const go = (item: PaletteItem | undefined) => {
    if (!item) return;
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(item.href);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const searching = trimmed.length >= SEARCH_MIN_LENGTH;
  let lastGroup = "";

  return (
    <>
      {variant === "bar" ? (
        <button
          type="button"
          onClick={openPalette}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="relative flex h-[38px] w-full max-w-md items-center rounded-control bg-surface-container-low pr-14 pl-9 text-left text-body-sm text-ink-placeholder transition-colors hover:bg-surface-container focus-visible:shadow-focus focus-visible:outline-none"
        >
          <Icon name="search" size={18} className="pointer-events-none absolute left-space-sm text-outline" />
          <span className="truncate">Search workspace, orders, clients...</span>
          <kbd className="absolute right-space-sm rounded-sm bg-surface-container px-1.5 py-0.5 text-[10px] text-outline">{shortcut}</kbd>
        </button>
      ) : (
        <button
          type="button"
          onClick={openPalette}
          aria-haspopup="dialog"
          aria-expanded={open}
          title="Search"
          className="rounded-control p-space-xs text-ink-muted transition-colors hover:bg-well hover:text-ink"
        >
          <Icon name="search" size={20} />
          <span className="sr-only">Search</span>
        </button>
      )}

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-scrim p-space-md pt-[12vh] backdrop-blur-sm" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search and commands"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-modal border border-line bg-card shadow-level-3"
          >
            <div className="flex items-center gap-space-sm border-b border-line px-space-md">
              <Icon name="search" size={20} className="text-outline" />
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                  if (e.target.value.trim().length < SEARCH_MIN_LENGTH) setResults([]);
                }}
                onKeyDown={onInputKey}
                placeholder="Search customers, orders, tasks or type a command..."
                className="h-12 flex-1 bg-transparent text-body-md text-ink placeholder:text-ink-placeholder focus:outline-none"
              />
              <kbd className="rounded-sm bg-surface-container px-1.5 py-0.5 text-[10px] text-outline">Esc</kbd>
            </div>
            <ul id={listId} role="listbox" aria-label="Results" className="flex-1 overflow-y-auto p-space-xs">
              {items.map((item, index) => {
                const header = item.group !== lastGroup ? item.group : null;
                lastGroup = item.group;
                return (
                  <li key={item.id} role="presentation">
                    {header ? (
                      <p role="presentation" className="px-space-sm pt-space-sm pb-space-xs text-label-sm tracking-wider text-ink-subtle uppercase">
                        {header}
                      </p>
                    ) : null}
                    <div
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === active}
                      onMouseMove={() => setActive(index)}
                      onClick={() => go(item)}
                      className={cn(
                        "flex cursor-pointer items-center gap-space-sm rounded-control px-space-sm py-space-sm",
                        index === active ? "bg-accent-tint text-ink" : "text-ink-muted",
                      )}
                    >
                      <Icon name={item.icon} size={18} className={index === active ? "text-accent" : "text-outline"} />
                      <span className="min-w-0 flex-1 truncate text-label-md">{item.label}</span>
                      {item.hint ? <span className="max-w-[40%] truncate text-body-sm text-ink-subtle">{item.hint}</span> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-line px-space-md py-space-xs text-body-sm text-ink-subtle" aria-live="polite">
              {status === "loading"
                ? "Searching..."
                : status === "error"
                  ? "Search failed. Try again."
                  : searching && results.length === 0
                    ? `No records match "${trimmed}".`
                    : "↑↓ to navigate · Enter to open · Esc to close"}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
