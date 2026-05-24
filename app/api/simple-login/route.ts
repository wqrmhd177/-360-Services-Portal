import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSupabaseClient } from "@/lib/supabaseClient";
import type { UserRole } from "@/lib/simpleAuth";

const DEFAULT_VIEW_ROLE: UserRole = "growth";

function sessionForAdmin(email: string, fullName: string) {
  return {
    email,
    fullName,
    role: DEFAULT_VIEW_ROLE,
    isAdmin: true as const,
  };
}

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
      // For signup, use provided role and fullName
      const role = body?.role;
      const fullName = body?.fullName?.trim();
      
      if (!role || !fullName) {
        return NextResponse.json({ error: "Missing name or role for signup" }, { status: 400 });
      }

      // Hash password for storage
      const passwordHash = await bcrypt.hash(password, 12);

      // Create or update user profile in database with password hash
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            email,
            full_name: fullName,
            role,
            password_hash: passwordHash,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: "email"
          }
        );

      if (upsertError) {
        console.error("Failed to create profile:", upsertError);
        return NextResponse.json({ 
          error: "Failed to create user profile",
          details: upsertError.message 
        }, { status: 500 });
      }

      const session = role === "admin"
        ? sessionForAdmin(email, fullName)
        : { email, role, fullName };

      cookies().set("portal_session", JSON.stringify(session), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });

      return NextResponse.json({ ok: true });
    } else {
      // For login, look up user's role and password hash from database
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("email, full_name, role, password_hash")
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

      if (!profile.password_hash) {
        // Existing profile without password hash cannot log in securely
        return NextResponse.json(
          { error: "Account not configured for password login. Please contact admin." },
          { status: 400 }
        );
      }

      const passwordMatches = await bcrypt.compare(password, profile.password_hash);
      if (!passwordMatches) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }

      if (!profile.role) {
        return NextResponse.json(
          { error: "User role not assigned. Please contact admin." },
          { status: 400 }
        );
      }

      const fullName = (profile.full_name || body?.fullName?.trim() || email.split("@")[0]) ?? "User";
      const session = profile.role === "admin"
        ? sessionForAdmin(profile.email, fullName)
        : {
            email: profile.email,
            role: profile.role,
            fullName,
          };

      cookies().set("portal_session", JSON.stringify(session), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });

      return NextResponse.json({ ok: true });
    }
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

