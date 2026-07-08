import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { passwordFields, passwordMatches } from "@/lib/passwordAuth";
import { buildPortalSession } from "@/lib/buildPortalSession";
import { isSignupTeam, type SignupTeam } from "@/lib/simpleAuth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    team?: SignupTeam;
    fullName?: string;
    isSignUp?: boolean;
  } | null;

  const email = body?.email?.toLowerCase().trim();
  const password = body?.password ?? "";
  const isSignUp = body?.isSignUp ?? false;

  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseClient();

    if (isSignUp) {
      const team = body?.team;
      const fullName = body?.fullName?.trim();

      if (!team || !fullName) {
        return NextResponse.json({ error: "Missing name or team for signup" }, { status: 400 });
      }

      if (!isSignupTeam(team)) {
        return NextResponse.json({ error: "Invalid team for signup" }, { status: 403 });
      }

      const { data: existing } = await supabase
        .from("profiles")
        .select("email")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in." },
          { status: 409 }
        );
      }

      const fields = await passwordFields(password);

      const { error: insertError } = await supabase.from("profiles").insert({
        email,
        full_name: fullName,
        team,
        role: null,
        permissions: null,
        password: fields.password,
        password_hash: fields.password_hash,
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error("Failed to create profile:", insertError);
        return NextResponse.json(
          { error: "Failed to create user profile", details: insertError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        message: "Account created. An admin will assign your portal access.",
      });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("email, full_name, role, password, password_hash, permissions")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json({ error: "Login failed" }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json(
        { error: "User not found. Please sign up first." },
        { status: 404 }
      );
    }

    if (!profile.password && !profile.password_hash) {
      return NextResponse.json(
        { error: "Account has no password set. Use forgot password or ask admin." },
        { status: 400 }
      );
    }

    if (!(await passwordMatches(password, profile))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Keep plain password column in sync for admin visibility in Supabase
    if (!profile.password) {
      const { error: syncError } = await supabase
        .from("profiles")
        .update({ password, updated_at: new Date().toISOString() })
        .eq("email", email);
      if (syncError) {
        console.error("Failed to sync plain password:", syncError);
      }
    }

    if (!profile.role) {
      return NextResponse.json(
        { error: "User role not assigned. Please contact admin." },
        { status: 400 }
      );
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
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
