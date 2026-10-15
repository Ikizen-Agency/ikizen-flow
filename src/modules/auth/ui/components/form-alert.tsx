import { Icon } from "@/shared/ui/icon";

export function FormAlert({ message, tone = "danger" }: { message: string; tone?: "danger" | "info" }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={
        tone === "danger"
          ? "flex items-start gap-space-sm rounded-control border border-danger-border bg-danger-tint p-space-sm text-body-sm text-danger-strong"
          : "flex items-start gap-space-sm rounded-control border border-line bg-surface-container-low p-space-sm text-body-sm text-ink-muted"
      }
    >
      <Icon name={tone === "danger" ? "error" : "info"} size={18} className="mt-px shrink-0" />
      <span>{message}</span>
    </div>
  );
}
