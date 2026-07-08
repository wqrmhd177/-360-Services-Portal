import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { passwordFields, validatePasswordReset } from "@/lib/passwordAuth";
import { generateOtp, storeOtp, sendOtpEmail, verifyOtp } from "@/lib/emailOtp";

export async function POST(request: Request) {
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

  try {
    const supabase = createSupabaseClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, role")
      .eq("email", email)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Password reset is only available for portal admin accounts." },
        { status: 403 }
      );
    }
  } catch (err) {
    console.error("Admin forgot-password lookup error:", err);
    return NextResponse.json({ error: "Unable to process request." }, { status: 500 });
  }

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
      message: "A reset code has been sent to your email.",
    });
  }

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

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          ...fields,
          updated_at: new Date().toISOString(),
        })
        .eq("email", email)
        .eq("role", "admin");

      if (updateError) {
        console.error("Admin password update error:", updateError);
        return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("Admin forgot password error:", err);
      return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid step." }, { status: 400 });
}
