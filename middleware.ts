import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_API_PREFIXES = [
  "/api/simple-login",
  "/api/admin-login",
  "/api/forgot-password",
  "/api/admin-forgot-password",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/health",
  "/api/cron/",
  "/api/announcements/active",
];

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}

function hasSession(request: NextRequest): boolean {
  const raw = request.cookies.get("portal_session")?.value;
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { email?: string };
    return Boolean(parsed.email);
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard") && !hasSession(request)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/api/") && !isPublicApi(pathname) && !hasSession(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    process.env.NODE_ENV === "production" &&
    (pathname === "/api/check-setup" ||
      pathname === "/api/debug-qr" ||
      pathname === "/api/test-notifications")
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
