import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { passwordMatches } from "@/lib/passwordAuth";
import { buildPortalSession } from "@/lib/buildPortalSession";

/** Admin login uses the same profiles table — only users with role=admin may sign in here. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  const email = body?.email?.toLowerCase().trim();
  const password = body?.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("email, full_name, role, password, password_hash, permissions")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("Admin login lookup error:", error);
      return NextResponse.json({ error: "Login failed" }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (profile.role !== "admin") {
      return NextResponse.json(
        { error: "This account is not a portal admin. Sign in on the main page or ask an admin to grant access." },
        { status: 403 }
      );
    }

    if (!(await passwordMatches(password, profile))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const session = buildPortalSession({
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      permissions: profile.permissions,
    });

    cookies().set("portal_session", JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "Admin login failed" }, { status: 500 });
  }
}
