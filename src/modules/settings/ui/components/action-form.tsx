"use client";

import { useActionState, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Button, type ButtonVariant } from "@/shared/ui/button";
import { IDLE, type SettingsActionState } from "../form-schema";
import { ActionFeedback } from "./action-feedback";

export interface ActionFormProps {
  action: (prev: SettingsActionState, formData: FormData) => Promise<SettingsActionState>;
  submitLabel: string;
  pendingLabel?: string;
  icon?: string;
  variant?: ButtonVariant;
  /** Read-only mode: fields stay visible, the submit button is hidden. */
  readOnly?: boolean;
  /** Hidden fields sent with the form. */
  fields?: Record<string, string | number>;
  /** Resets the inputs after a successful submit (e.g. invitation and password forms). */
  resetOnSuccess?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Settings form: submits a Server Action and shows its inline result. Fields are passed as children. */
export function ActionForm({ action, submitLabel, pendingLabel = "Saving...", icon, variant = "primary", readOnly, fields, resetOnSuccess, className, children }: ActionFormProps) {
  const [state, dispatch, pending] = useActionState(action, IDLE);
  return (
    <form
      action={dispatch}
      key={resetOnSuccess && state.status === "success" ? state.message : undefined}
      className={cn("flex flex-col gap-space-md", className)}
    >
      {Object.entries(fields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={String(value)} />
      ))}
      <fieldset disabled={readOnly || pending} className="contents">
        {children}
      </fieldset>
      <ActionFeedback state={state} />
      {readOnly ? null : (
        <div className="flex justify-end">
          <Button type="submit" icon={icon} variant={variant} disabled={pending}>
            {pending ? pendingLabel : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}

export interface ActionButtonProps {
  action: (prev: SettingsActionState, formData: FormData) => Promise<SettingsActionState>;
  label: string;
  pendingLabel?: string;
  icon?: string;
  variant?: ButtonVariant;
  fields?: Record<string, string | number>;
  className?: string;
}

/** One-button form (revoke, retry, send test) with its inline result. */
export function ActionButton({ action, label, pendingLabel = "Working...", icon, variant = "secondary", fields, className }: ActionButtonProps) {
  const [state, dispatch, pending] = useActionState(action, IDLE);
  return (
    <form action={dispatch} className={cn("flex flex-col items-end gap-space-xs", className)}>
      {Object.entries(fields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={String(value)} />
      ))}
      <Button type="submit" size="sm" icon={icon} variant={variant} disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      <ActionFeedback state={state} className="max-w-sm" />
    </form>
  );
}
