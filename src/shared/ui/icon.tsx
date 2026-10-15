import { cn } from "@/shared/lib/cn";

export interface IconProps {
  /** Material Symbols ligature name, e.g. "dashboard" or "trending_up". */
  name: string;
  /** Rendered glyph size in pixels. */
  size?: number;
  filled?: boolean;
  className?: string;
  /** Accessible label. When omitted the icon is treated as decorative. */
  label?: string;
}

export function Icon({ name, size = 20, filled = false, className, label }: IconProps) {
  return (
    <span
      className={cn("material-symbols-outlined shrink-0", className)}
      style={{ fontSize: size, width: size, height: size }}
      data-filled={filled ? "true" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {name}
    </span>
  );
}
