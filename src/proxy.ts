import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/shared/lib/supabase/middleware";

/**
 * Routes that require authentication.
 * Users without a session will be redirected to /login.
 */
const PROTECTED_ROUTES = ["/dashboard", "/auditor"];

/**
 * Routes that are only accessible to unauthenticated users.
 * Authenticated users will be redirected to /dashboard.
 */
const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

export async function proxy(request: NextRequest) {
  // Redirect www → non-www so all traffic uses the canonical domain.
  // This prevents auth mismatches (Supabase only allows one redirect domain)
  // and cookie/session issues from split origins.
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("www.")) {
    const canonical = process.env.NEXT_PUBLIC_APP_URL;
    if (canonical) {
      const url = new URL(request.url);
      url.host = host.replace(/^www\./, "");
      url.protocol = "https";
      return NextResponse.redirect(url, 301);
    }
  }

  const { user, supabaseResponse } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  const isAuthRoute = AUTH_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
