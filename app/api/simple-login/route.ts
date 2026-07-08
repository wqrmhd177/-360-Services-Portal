import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { passwordFields, passwordMatches } from "@/lib/passwordAuth";
import { buildPortalSession } from "@/lib/buildPortalSession";
import type { UserRole } from "@/lib/simpleAuth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    role?: UserRole;
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
      const role = body?.role;
      const fullName = body?.fullName?.trim();

      if (!role || !fullName) {
        return NextResponse.json({ error: "Missing name or role for signup" }, { status: 400 });
      }

      const fields = await passwordFields(password);

      const { error: upsertError } = await supabase.from("profiles").upsert(
        {
          email,
          full_name: fullName,
          role,
          password: fields.password,
          password_hash: fields.password_hash,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );

      if (upsertError) {
        console.error("Failed to create profile:", upsertError);
        return NextResponse.json(
          { error: "Failed to create user profile", details: upsertError.message },
          { status: 500 }
        );
      }

      const session = buildPortalSession({
        email,
        full_name: fullName,
        role,
      });

      cookies().set("portal_session", JSON.stringify(session), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });

      return NextResponse.json({ ok: true });
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
