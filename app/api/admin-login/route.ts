import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { UserRole } from "@/lib/simpleAuth";

const DEFAULT_ROLE: UserRole = "growth";

export async function POST(request: Request) {
  const adminEmail = process.env.PORTAL_ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.PORTAL_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return NextResponse.json(
      { error: "Admin login is not configured. Set PORTAL_ADMIN_EMAIL and PORTAL_ADMIN_PASSWORD." },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  const email = body?.email?.toLowerCase().trim();
  const password = body?.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }

  if (email !== adminEmail || password !== adminPassword) {
    return NextResponse.json({ error: "Invalid admin credentials" }, { status: 401 });
  }

  const session = {
    email: adminEmail,
    fullName: "Admin",
    role: DEFAULT_ROLE,
    isAdmin: true,
  };

  cookies().set("portal_session", JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return NextResponse.json({ ok: true });
}
