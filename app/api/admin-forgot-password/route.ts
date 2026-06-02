import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { passwordFields, validatePasswordReset } from "@/lib/passwordAuth";
import { generateOtp, storeOtp, sendOtpEmail, verifyOtp } from "@/lib/emailOtp";

export async function POST(request: Request) {
  const adminEmail = process.env.PORTAL_ADMIN_EMAIL?.toLowerCase().trim();

  if (!adminEmail) {
    return NextResponse.json(
      { error: "Admin login is not configured. Set PORTAL_ADMIN_EMAIL." },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    step?: "request" | "reset";
    email?: string;
    otp?: string;
    newPassword?: string;
    confirmPassword?: string;
  } | null;

  const step = body?.step ?? "request";
  const email = body?.email?.toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (email !== adminEmail) {
    return NextResponse.json(
      { error: "This reset is only for the configured admin account." },
      { status: 403 }
    );
  }

  // ── Step 1: Send OTP ─────────────────────────────────────────────────────
  if (step === "request") {
    try {
      const otp = generateOtp();
      await storeOtp(email, otp);
      await sendOtpEmail(email, otp);
    } catch (err) {
      console.error("Admin OTP error:", err);
      return NextResponse.json({ error: "Unable to send reset code. Please try again." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "A reset code has been sent to the admin email.",
    });
  }

  // ── Step 2: Verify OTP and Reset Password ────────────────────────────────
  if (step === "reset") {
    const otp = body?.otp?.trim() ?? "";
    const newPassword = body?.newPassword ?? "";
    const confirmPassword = body?.confirmPassword ?? "";

    if (!otp) {
      return NextResponse.json({ error: "Reset code is required." }, { status: 400 });
    }

    const validationError = validatePasswordReset(newPassword, confirmPassword);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const otpValid = await verifyOtp(email, otp);
    if (!otpValid) {
      return NextResponse.json(
        { error: "Invalid or expired reset code. Please request a new one." },
        { status: 400 }
      );
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
        console.error("Admin password update error:", upsertError);
        return NextResponse.json({ error: "Unable to reset admin password." }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("Admin forgot password error:", err);
      return NextResponse.json({ error: "Unable to reset admin password." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid request." }, { status: 400 });
}
