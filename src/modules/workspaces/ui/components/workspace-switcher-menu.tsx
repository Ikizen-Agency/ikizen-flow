"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Field, Input } from "@/shared/ui/input";
import { createWorkspaceAction, switchWorkspaceAction, type CreateWorkspaceState } from "../actions";
import type { WorkspaceOption } from "../queries";

/** Sidebar workspace card: lists the user's workspaces (active one checked), switches, and creates new ones. */
export function WorkspaceSwitcherMenu({ workspaces }: { workspaces: WorkspaceOption[] }) {
  const active = workspaces.find((w) => w.active) ?? workspaces[0]!;
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>("[data-menu-item]")?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative hidden lg:block">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-control bg-surface-container-low p-space-sm text-left transition-colors hover:bg-surface-container"
      >
        <span className="flex min-w-0 flex-col pr-space-xs">
          <span className="truncate text-label-md text-ink">{active.name}</span>
          <span className="truncate text-body-sm text-ink-subtle">{active.tagline || active.roleLabel}</span>
        </span>
        <Icon name="unfold_more" size={18} className="text-outline" />
        <span className="sr-only">Switch workspace</span>
      </button>
      {open ? (
        <div id={menuId} role="menu" aria-label="Workspaces" className="absolute inset-x-0 top-full z-10 mt-space-xs rounded-card border border-line bg-card p-space-xs shadow-level-2">
          <p className="px-space-sm py-space-xs text-label-sm tracking-wider text-ink-subtle uppercase">Your workspaces</p>
          <ul>
            {workspaces.map((w) => (
              <li key={w.id} role="none">
                <form action={switchWorkspaceAction}>
                  <input type="hidden" name="workspaceId" value={w.id} />
                  <button
                    type="submit"
                    role="menuitemradio"
                    aria-checked={w.active}
                    data-menu-item
                    className="flex w-full items-center gap-space-sm rounded-control px-space-sm py-space-xs text-left transition-colors hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline-none"
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
          <div className="mt-space-xs border-t border-line pt-space-xs">
            <button
              type="button"
              role="menuitem"
              data-menu-item
              onClick={() => {
                setOpen(false);
                setCreating(true);
              }}
              className="flex w-full items-center gap-space-sm rounded-control px-space-sm py-space-sm text-left text-label-md text-ink-muted transition-colors hover:bg-surface-container-low hover:text-ink focus-visible:bg-surface-container-low focus-visible:outline-none"
            >
              <Icon name="add" size={18} />
              Create workspace
            </button>
          </div>
        </div>
      ) : null}
      {creating ? (
        <CreateWorkspaceDialog
          onClose={() => {
            setCreating(false);
            trigger.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}

function CreateWorkspaceDialog({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState<CreateWorkspaceState, FormData>(createWorkspaceAction, {});
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    panel.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-scrim p-space-md backdrop-blur-sm" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-modal bg-card shadow-level-3"
      >
        <form action={action} className="flex flex-col gap-space-md p-space-lg">
          <div>
            <h2 id={titleId} className="text-headline-sm text-ink">
              Create workspace
            </h2>
            <p className="mt-1 text-body-sm text-ink-subtle">You will be its owner. Customers, sales and tasks are kept separate per workspace.</p>
          </div>
          <Field label="Workspace name" htmlFor="workspace-name" error={state.error}>
            <Input
              id="workspace-name"
              name="name"
              required
              maxLength={60}
              defaultValue={state.values?.name}
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? "workspace-name-error" : undefined}
              placeholder="Acme Studio"
            />
          </Field>
          <Field label="Tagline (optional)" htmlFor="workspace-tagline">
            <Input id="workspace-tagline" name="tagline" maxLength={80} defaultValue={state.values?.tagline} placeholder="Digital Operations" />
          </Field>
          <div className="flex justify-end gap-space-sm">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} icon="add">
              {pending ? "Creating..." : "Create workspace"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
