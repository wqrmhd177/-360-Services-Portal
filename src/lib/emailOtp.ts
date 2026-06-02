import { createSupabaseClient } from "@/lib/supabaseClient";
import { Resend } from "resend";

const OTP_EXPIRY_MINUTES = 15;

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function storeOtp(email: string, otp: string): Promise<void> {
  const supabase = createSupabaseClient();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  // Upsert — one active OTP per email at a time
  const { error } = await supabase.from("password_reset_tokens").upsert(
    { email, otp, expires_at: expiresAt, used: false },
    { onConflict: "email" }
  );

  if (error) {
    console.error("OTP store error:", error);
    throw new Error("Unable to generate reset code.");
  }
}

export async function verifyOtp(email: string, otp: string): Promise<boolean> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("password_reset_tokens")
    .select("otp, expires_at, used")
    .eq("email", email)
    .single();

  if (error || !data) return false;
  if (data.used) return false;
  if (new Date(data.expires_at) < new Date()) return false;
  if (data.otp !== otp) return false;

  // Mark as used
  await supabase
    .from("password_reset_tokens")
    .update({ used: true })
    .eq("email", email);

  return true;
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Dev fallback — log OTP to console so developers can still test locally
    console.info(`[DEV] Password reset OTP for ${email}: ${otp}`);
    return;
  }

  const resend = new Resend(apiKey);
  const fromAddress = process.env.RESEND_FROM_EMAIL || "noreply@360portal.app";
  const portalName = process.env.PORTAL_NAME || "360 Services Portal";

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: email,
    subject: `${portalName} — Password Reset Code`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1e3a5f;margin-bottom:8px">${portalName}</h2>
        <p style="color:#374151;margin-bottom:24px">You requested a password reset. Use the code below — it expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
        <div style="background:#f3f4f6;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1e3a5f">${otp}</span>
        </div>
        <p style="color:#6b7280;font-size:13px">If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    console.error("Resend email error:", error);
    throw new Error("Failed to send reset code email.");
  }
}
