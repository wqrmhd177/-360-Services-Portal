import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";

export async function GET() {
  const supabase = createSupabaseClient();
  
  try {
    // Check profiles table
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name, role");

    // Check notifications table structure
    const { data: notifications, error: notifError } = await supabase
      .from("notifications")
      .select("*")
      .limit(5);

    // Check recent QRs
    const { data: qrs, error: qrError } = await supabase
      .from("qr")
      .select("id, qr_number, created_by_email, status")
      .order("created_at", { ascending: false })
      .limit(5);

    return NextResponse.json({
      status: "success",
      profiles: {
        count: profiles?.length || 0,
        data: profiles || [],
        error: profileError?.message
      },
      notifications: {
        count: notifications?.length || 0,
        data: notifications || [],
        error: notifError?.message
      },
      qrs: {
        count: qrs?.length || 0,
        data: qrs || [],
        error: qrError?.message
      },
      message: profiles?.length === 0 
        ? "⚠️ NO PROFILES FOUND! Please run create_test_users.sql in Supabase SQL Editor"
        : "✅ Setup looks good"
    });
  } catch (error: any) {
    return NextResponse.json({ 
      status: "error", 
      error: error.message 
    }, { status: 500 });
  }
}
