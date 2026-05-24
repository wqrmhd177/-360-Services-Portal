import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getUsersByRole } from "@/lib/notifications";

export async function GET() {
  const supabase = createSupabaseClient();
  
  try {
    // Check all profiles
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("*");

    // Check procurement users specifically
    const procurementEmails = await getUsersByRole("procurement");
    
    // Check approver users
    const approverEmails = await getUsersByRole("approver");
    
    // Check all notifications
    const { data: notifications, error: notifError } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      profiles: profiles || [],
      profileError,
      procurementEmails,
      approverEmails,
      notifications: notifications || [],
      notifError
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
