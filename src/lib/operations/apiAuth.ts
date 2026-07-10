import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "portal_session";

export function isPortalAuthenticated(request: NextRequest): boolean {
  const val = request.cookies.get(SESSION_COOKIE)?.value;
  if (!val) return false;
  try {
    const parsed = JSON.parse(val);
    return Boolean(parsed?.email);
  } catch {
    return false;
  }
}

export function parsePageParams(request: NextRequest, defaultLimit = 25) {
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") ?? String(defaultLimit), 10) || defaultLimit)
  );
  const search = request.nextUrl.searchParams.get("search") ?? "";
  return { page, limit, search };
}
