import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { isDataRoute } from "@/modules/auth/domain/redirect";

/**
 * Optimistic route protection (Next 16 Proxy, formerly Middleware): only checks that a session cookie
 * exists. The real check happens in the data layer (`@/server/request-context`), which validates the
 * session against the database on every page, Server Action and Route Handler.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (isDataRoute(pathname)) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to access this resource." }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except auth pages, Better Auth endpoints and static assets.
  matcher: ["/((?!api/auth|login|register|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
