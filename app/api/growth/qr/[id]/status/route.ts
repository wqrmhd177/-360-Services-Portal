import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { requireWriteAccess } from "@/lib/accessControl";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getPortalSession();
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "growth" && !session.isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Growth role required" },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    let updateQuery = supabase
      .from("qr")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    updateQuery = updateQuery.eq("created_by_email", session!.email);
    const { error } = await updateQuery;

    if (error) {
      console.error("Error updating QR status:", error);
      return NextResponse.json(
        { error: "Failed to update QR status" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error in QR status update:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
