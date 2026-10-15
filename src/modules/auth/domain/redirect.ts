const AUTH_PAGES = ["/login", "/register"];

/**
 * Post-login destination from an untrusted `?next=` value: only same-origin relative paths are allowed
 * (no `//host`, `/\host` or scheme tricks) and auth pages fall back to the dashboard.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  const pathname = next.split(/[?#]/)[0]!;
  if (AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))) return "/";
  return next;
}
