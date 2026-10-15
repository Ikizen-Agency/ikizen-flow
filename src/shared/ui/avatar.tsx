import type { AvatarColor } from "@/shared/domain/avatar-colors";
import { cn } from "@/shared/lib/cn";

const palettes = [
  "bg-primary-fixed text-on-primary-fixed-variant",
  "bg-secondary-container text-on-secondary-fixed-variant",
  "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  "bg-surface-container-high text-on-surface",
] as const;

/** Explicit colour picked by a member (Settings > Profile); otherwise the colour is derived from the name. */
const colors: Record<AvatarColor, string> = {
  primary: palettes[0],
  secondary: palettes[1],
  tertiary: palettes[2],
  neutral: palettes[3],
  success: "bg-success-tint text-success-strong",
  warning: "bg-warning-tint text-warning-strong",
  danger: "bg-danger-tint text-danger-strong",
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return (first + last).toUpperCase();
}

function paletteFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palettes[hash % palettes.length];
}

export interface AvatarProps {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  /** Rounded-square tile (companies) instead of a circle (people). */
  square?: boolean;
  /** Chosen colour; falls back to a stable colour derived from the name. */
  color?: AvatarColor | null;
  className?: string;
}

const sizes = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-label-sm",
  md: "size-10 text-label-md",
  lg: "size-12 text-headline-sm",
};

export function Avatar({ name, size = "sm", square = false, color, className }: AvatarProps) {
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold",
        square ? "rounded-control" : "rounded-full",
        sizes[size],
        color ? colors[color] : paletteFor(name),
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
