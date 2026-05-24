import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getPortalSession();
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canAccess = session.role === "approver" || session.role === "finance" || session.isAdmin;
    if (!canAccess) {
      return NextResponse.json(
        { error: "Forbidden - Approver or Finance role required" },
        { status: 403 }
      );
    }

    const { id } = params;
    const supabase = createSupabaseClient();

    const { data: pr, error } = await supabase
      .from("pr")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !pr) {
      return NextResponse.json({ error: "PR not found" }, { status: 404 });
    }

    return NextResponse.json({ pr });
  } catch (error) {
    console.error("Error fetching PR:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
