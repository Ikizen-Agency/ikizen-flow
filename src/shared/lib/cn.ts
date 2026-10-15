/** Joins truthy class names. Tiny, dependency-free alternative to clsx. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
