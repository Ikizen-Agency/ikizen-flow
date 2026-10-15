import { hasControlOrWhitespace } from "@/shared/domain/control-characters";

const AUTH_PAGES = ["/login", "/register"];
// Browsers strip tabs/newlines while parsing URLs, so "/\t/host" would become the protocol-relative "//host".

/**
 * Post-login destination from an untrusted `?next=` value: only same-origin relative paths are allowed
 * (no `//host`, `/\host`, control-character or scheme tricks) and auth pages fall back to the dashboard.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || hasControlOrWhitespace(next)) {
    return "/";
  }
  const pathname = next.split(/[?#]/)[0]!;
  if (AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))) return "/";
  return next;
}
