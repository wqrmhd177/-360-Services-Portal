import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import {
  extractProcurementImageGroups,
  type ProcurementResponseMap,
} from "@/lib/procurementImages";

const VIEW_ROLES = new Set(["growth", "approver", "procurement", "finance", "admin"]);

function canViewPo(
  session: { email: string; role?: string; isAdmin?: boolean },
  po: { pr_id: string | null; created_by_email?: string },
  pr: { created_by_email?: string; from_qr_id?: string | null } | null
): boolean {
  if (session.isAdmin) return true;
  if (!session.role || !VIEW_ROLES.has(session.role)) return false;

  if (session.role === "growth") {
    if (pr?.created_by_email) {
      return pr.created_by_email === session.email;
    }
    return po.created_by_email === session.email;
  }

  return true;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseClient();
    const { data: po, error: poError } = await supabase
      .from("po")
      .select("id, pr_id, created_by_email")
      .eq("id", params.id)
      .maybeSingle();

    if (poError || !po) {
      return NextResponse.json({ error: "PO not found" }, { status: 404 });
    }

    let pr: { created_by_email?: string; from_qr_id?: string | null } | null = null;
    if (po.pr_id) {
      const { data: prRow } = await supabase
        .from("pr")
        .select("created_by_email, from_qr_id")
        .eq("id", po.pr_id)
        .maybeSingle();
      pr = prRow;
    }

    if (!canViewPo(session, po, pr)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!pr?.from_qr_id) {
      return NextResponse.json({ groups: [], qrNumber: null });
    }

    const { data: qr, error: qrError } = await supabase
      .from("qr")
      .select("qr_number, purchase_details, procurement_response")
      .eq("id", pr.from_qr_id)
      .maybeSingle();

    if (qrError || !qr) {
      return NextResponse.json({ groups: [], qrNumber: null });
    }

    const procurementResponse =
      qr.procurement_response && typeof qr.procurement_response === "object"
        ? (qr.procurement_response as ProcurementResponseMap)
        : null;

    const groups = extractProcurementImageGroups(
      qr.purchase_details as Array<{ productName?: string }> | null,
      procurementResponse
    );

    return NextResponse.json({
      groups,
      qrNumber: qr.qr_number ?? null,
    });
  } catch (error) {
    console.error("Failed to load procurement images for PO:", error);
    return NextResponse.json(
      { error: "Failed to load procurement images" },
      { status: 500 }
    );
  }
}
