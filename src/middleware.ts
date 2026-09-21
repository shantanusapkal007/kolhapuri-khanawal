import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protected administrative and operational routes
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/billing",
  "/settings",
  "/reports",
  "/inventory",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public routes, static assets, and auth endpoints
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/sync") ||
    pathname.startsWith("/icons") ||
    pathname === "/login" ||
    pathname === "/favicon.ico" ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // 2. Check for auth_session cookie or authorization header
  const authSessionCookie = request.cookies.get("auth_session")?.value;
  const authHeader = request.headers.get("authorization");

  const isAuthenticated = Boolean(authSessionCookie || authHeader);

  // 3. For protected web pages, redirect unauthenticated users to /login
  const isProtectedPage = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtectedPage && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/billing/:path*",
    "/settings/:path*",
    "/reports/:path*",
    "/inventory/:path*",
    "/api/bills/:path*",
    "/api/inventory/:path*",
  ],
};
