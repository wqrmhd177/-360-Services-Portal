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
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, parseInt(request.nextUrl.searchParams.get("page_size") ?? "100", 10) || 100),
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: prs, error } = await supabase
      .from("pr")
      .select("*")
      .eq("approval_status", "approved")
      .order("created_at", { ascending: false })
      .range(from, to);

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
