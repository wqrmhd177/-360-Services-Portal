import { NextResponse } from "next/server";
import { hasZambeelAccess as hasZambeelFromPerms } from "@/lib/permissions";
import type { PortalSession } from "@/lib/session";
import { unauthorizedResponse } from "@/lib/accessControl";

export function hasZambeelAccess(session: PortalSession | null | undefined): boolean {
  if (!session?.email) return false;
  return hasZambeelFromPerms({
    role: session.role,
    isAdmin: session.isAdmin,
    permissions: session.permissions,
  });
}

export function requireZambeelAccess(
  session: PortalSession | null | undefined,
): NextResponse | null {
  if (!session?.email) return unauthorizedResponse();
  if (!hasZambeelAccess(session)) {
    return NextResponse.json({ error: "Forbidden — Zambeel 360 access required" }, { status: 403 });
  }
  return null;
}

export function isActiveRole(
  session: PortalSession | null | undefined,
  roles: string[],
): boolean {
  if (!session?.email) return false;
  if (session.isAdmin) return true;
  return !!session.role && roles.includes(session.role);
}
