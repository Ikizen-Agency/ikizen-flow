/** Avatar colour choices a member can pick for their initials (mapped to design tokens by `Avatar`). */
export const AVATAR_COLORS = ["primary", "secondary", "tertiary", "neutral", "success", "warning", "danger"] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const AVATAR_COLOR_LABELS: Record<AvatarColor, string> = {
  primary: "Blue",
  secondary: "Lilac",
  tertiary: "Teal",
  neutral: "Slate",
  success: "Green",
  warning: "Amber",
  danger: "Rose",
};

export function isAvatarColor(value: unknown): value is AvatarColor {
  return typeof value === "string" && (AVATAR_COLORS as readonly string[]).includes(value);
}
