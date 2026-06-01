import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import type { PoStatusHistoryEntry } from "@/types/workflows";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canReopen = session.role === "procurement" || session.isAdmin;
  if (!canReopen) {
    return NextResponse.json(
      { error: "Forbidden — Procurement or Admin role required" },
      { status: 403 }
    );
  }

  const supabase = createSupabaseClient();
  const poId = params.id;

  const { data: po, error: fetchError } = await supabase
    .from("po")
    .select("id, status, status_history, po_number")
    .eq("id", poId)
    .single();

  if (fetchError || !po) {
    return NextResponse.json({ error: "PO not found" }, { status: 404 });
  }

  if (po.status !== "canceled") {
    return NextResponse.json(
      { error: "Only canceled POs can be reopened" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const remarks: string = body.remarks ?? "";

  const historyEntry: PoStatusHistoryEntry = {
    status: "order_placed",
    timestamp: new Date().toISOString(),
    changed_by: session.email,
    remarks: remarks || "PO reopened",
  };

  const existingHistory: PoStatusHistoryEntry[] = Array.isArray(po.status_history)
    ? po.status_history
    : [];

  const { error: updateError } = await supabase
    .from("po")
    .update({
      status: "order_placed",
      status_history: [...existingHistory, historyEntry],
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  if (updateError) {
    console.error("Error reopening PO:", updateError);
    return NextResponse.json({ error: "Failed to reopen PO" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
