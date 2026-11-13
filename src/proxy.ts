import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate only: bounces visitors without a session cookie away from
 * protected areas and tags every request with an id for audit correlation.
 * Real authentication + authorization happen server-side in every page/action.
 */
const PROTECTED = /^\/(admin|user|vendor)(\/|$)/;

export function proxy(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);

  if (PROTECTED.test(request.nextUrl.pathname) && !request.cookies.has("expenvia_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|icon.png|apple-icon.png|favicon.ico).*)"],
};
