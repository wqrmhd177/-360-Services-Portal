import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";

export async function GET(request: NextRequest) {
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

    const supabase = createSupabaseClient();

    // Get all PRs (Approver can see all)
    const { data: prs, error } = await supabase
      .from("pr")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching PRs:", error);
      return NextResponse.json(
        { error: "Failed to fetch PRs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ prs: prs || [] });
  } catch (error) {
    console.error("Error in Approver PRs API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
