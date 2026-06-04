import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { passwordFields, validatePasswordReset } from "@/lib/passwordAuth";
import { generateOtp, storeOtp, sendOtpEmail, verifyOtp } from "@/lib/emailOtp";

export async function POST(request: Request) {
  const adminEmail = process.env.PORTAL_ADMIN_EMAIL?.toLowerCase().trim();

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

  // Prevent users from resetting the admin account via this endpoint
  if (adminEmail && email === adminEmail) {
    return NextResponse.json(
      { error: "Use Admin Login → Forgot password to reset the admin account." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseClient();

  // ── Step 1: Request OTP ──────────────────────────────────────────────────
  if (step === "request") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    // Always return the same message to prevent email enumeration
    if (!profile) {
      return NextResponse.json({
        ok: true,
        message: "If an account exists for that email, a reset code has been sent.",
      });
    }

    let deliveryMethod: "email" | "dev-console" = "email";
    try {
      const otp = generateOtp();
      await storeOtp(email, otp);
      deliveryMethod = await sendOtpEmail(email, otp);
    } catch (err) {
      console.error("OTP generation/send error:", err);
      return NextResponse.json({ error: "Unable to send reset code. Please try again." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, a reset code has been sent.",
      deliveryMethod,
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
      const fields = await passwordFields(newPassword);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("email", email);

      if (updateError) {
        console.error("Password update error:", updateError);
        return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("Forgot password reset error:", err);
      return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid request." }, { status: 400 });
}
