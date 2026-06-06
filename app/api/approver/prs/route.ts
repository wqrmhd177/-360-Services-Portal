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

    const { searchParams } = new URL(request.url);
    const createdBy = searchParams.get("createdBy")?.trim() || "";

    const supabase = createSupabaseClient();

    let query = supabase
      .from("pr")
      .select("*")
      .order("created_at", { ascending: false });

    if (createdBy) {
      query = query.eq("created_by_email", createdBy);
    }

    const { data: prs, error } = await query;

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
