import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { passwordFields, validatePasswordReset } from "@/lib/passwordAuth";

export async function POST(request: Request) {
  const adminEmail = process.env.PORTAL_ADMIN_EMAIL?.toLowerCase().trim();

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    newPassword?: string;
    confirmPassword?: string;
  } | null;

  const email = body?.email?.toLowerCase().trim();
  const newPassword = body?.newPassword ?? "";
  const confirmPassword = body?.confirmPassword ?? "";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (adminEmail && email === adminEmail) {
    return NextResponse.json(
      { error: "Use Admin Login → Forgot password to reset the admin account." },
      { status: 400 }
    );
  }

  const validationError = validatePasswordReset(newPassword, confirmPassword);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const supabase = createSupabaseClient();

    const { data: profile, error: lookupError } = await supabase
      .from("profiles")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (lookupError) {
      console.error("Forgot password lookup error:", lookupError);
      return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json(
        { error: "No account found with that email address." },
        { status: 404 }
      );
    }

    const fields = await passwordFields(newPassword);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        ...fields,
        updated_at: new Date().toISOString(),
      })
      .eq("email", email);

    if (updateError) {
      console.error("Forgot password update error:", updateError);
      return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
  }
}
