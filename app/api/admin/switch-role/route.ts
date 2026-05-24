import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";
import type { UserRole } from "@/lib/simpleAuth";

const ROLES: UserRole[] = ["growth", "approver", "procurement", "finance"];

export async function POST(request: Request) {
  const session = getPortalSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { role?: string } | null;
  const role = body?.role as UserRole | undefined;

  if (!role || !ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Invalid role. Use growth, approver, procurement, or finance." },
      { status: 400 }
    );
  }

  const updated = {
    ...session,
    role,
  };

  cookies().set("portal_session", JSON.stringify(updated), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ ok: true, role });
}
