import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const session = getPortalSession();
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "procurement" && !session.isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Procurement role required" },
        { status: 403 }
      );
    }

    const supabase = createSupabaseClient();

    // Procurement sees all PRs that have been approved (pending finance, verified, or po_created)
    const { data: prs, error } = await supabase
      .from("pr")
      .select("*")
      .eq("approval_status", "approved")
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
    console.error("Error in Procurement PRs API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
