"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Button } from "./button";
import { Icon } from "./icon";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** id of the element that names the dialog. */
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/**
 * Level 3 modal driven by component state (for confirmations and bulk forms that have no URL of their own).
 * Escape and scrim clicks close it; focus moves into the panel and returns to the trigger afterwards.
 */
export function Dialog({ open, onClose, labelledBy, className, children }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-scrim p-space-md backdrop-blur-sm" onClick={() => close.current()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn("flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-modal bg-card shadow-level-3 outline-none", className)}
      >
        {children}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  id: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Server Action (or `useActionState` dispatcher) submitted on confirm. */
  action: (formData: FormData) => void;
  /** Hidden form fields; arrays become repeated fields. */
  fields: Record<string, string | number | ReadonlyArray<string | number>>;
  pending?: boolean;
  error?: string | null;
}

/** Destructive confirmation (DESIGN.md): rose tint header icon, ghost cancel, solid red confirm. */
export function ConfirmDialog({ open, onClose, id, title, description, confirmLabel, action, fields, pending, error }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy={`${id}-title`}>
      <form action={action} className="flex flex-col gap-space-md p-space-lg">
        <div className="flex items-start gap-space-md">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-danger-line bg-danger-tint text-danger">
            <Icon name="warning" size={20} />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id={`${id}-title`} className="text-headline-sm text-ink">
              {title}
            </h2>
            <div className="text-body-md text-ink-muted">{description}</div>
          </div>
        </div>
        {Object.entries(fields).flatMap(([name, value]) =>
          (Array.isArray(value) ? value : [value]).map((v) => <input key={`${name}-${v}`} type="hidden" name={name} value={String(v)} />),
        )}
        {error ? (
          <p role="alert" className="rounded-control border border-danger-line bg-danger-tint p-space-sm text-body-sm text-danger-strong">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-space-sm">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="destructive-solid" disabled={pending}>
            {pending ? "Working..." : confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
