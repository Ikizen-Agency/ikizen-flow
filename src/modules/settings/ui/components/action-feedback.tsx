import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui/icon";
import type { SettingsActionState } from "../form-schema";

/** Inline result of a settings action (success or error), announced to assistive technology. */
export function ActionFeedback({ state, className }: { state: SettingsActionState; className?: string }) {
  if (state.status === "idle" || !state.message) return <span className="sr-only" aria-live="polite" />;
  const error = state.status === "error";
  return (
    <p
      role={error ? "alert" : "status"}
      className={cn(
        "flex items-start gap-space-xs rounded-control border p-space-sm text-body-sm",
        error ? "border-danger-line bg-danger-tint text-danger-strong" : "border-success-line bg-success-tint text-success-strong",
        className,
      )}
    >
      <Icon name={error ? "error" : "check_circle"} size={18} className="mt-px shrink-0" />
      <span>{state.message}</span>
    </p>
  );
}
