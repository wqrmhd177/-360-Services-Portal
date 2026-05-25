import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { passwordFields, validatePasswordReset } from "@/lib/passwordAuth";

export async function POST(request: Request) {
  const adminEmail = process.env.PORTAL_ADMIN_EMAIL?.toLowerCase().trim();

  if (!adminEmail) {
    return NextResponse.json(
      { error: "Admin login is not configured. Set PORTAL_ADMIN_EMAIL." },
      { status: 503 }
    );
  }

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

  if (email !== adminEmail) {
    return NextResponse.json(
      { error: "This reset is only for the configured admin account." },
      { status: 403 }
    );
  }

  const validationError = validatePasswordReset(newPassword, confirmPassword);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const supabase = createSupabaseClient();
    const fields = await passwordFields(newPassword);

    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        email: adminEmail,
        full_name: "Admin",
        role: "admin",
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );

    if (upsertError) {
      console.error("Admin forgot password error:", upsertError);
      return NextResponse.json({ error: "Unable to reset admin password." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin forgot password error:", error);
    return NextResponse.json({ error: "Unable to reset admin password." }, { status: 500 });
  }
}
