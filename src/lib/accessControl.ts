import { NextResponse } from "next/server";
import type { PortalSession } from "./session";
import type { UserRole } from "./simpleAuth";

export function isPortalAdmin(session: PortalSession | null | undefined): boolean {
  return !!session?.isAdmin;
}

export function canWrite(
  session: PortalSession | null | undefined,
  allowedRoles: UserRole[]
): boolean {
  if (!session?.email) return false;
  if (session.isAdmin) return true;
  return !!session.role && allowedRoles.includes(session.role);
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbiddenResponse(message = "Forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/** Returns a NextResponse if access denied, or null if the session may write. */
export function requireWriteAccess(
  session: PortalSession | null | undefined,
  allowedRoles: UserRole[],
  forbiddenMessage?: string
): NextResponse | null {
  if (!session?.email) return unauthorizedResponse();
  if (session.isAdmin) return null;
  if (!session.role || !allowedRoles.includes(session.role)) {
    return forbiddenResponse(forbiddenMessage);
  }
  return null;
}
