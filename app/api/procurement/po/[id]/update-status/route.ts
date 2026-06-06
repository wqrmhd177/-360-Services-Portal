import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { createNotification, getUsersByRole, notifyMultipleUsers } from "@/lib/notifications";
import type { PoStatus } from "@/types/workflows";
import { requireWriteAccess } from "@/lib/accessControl";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getPortalSession();
  const denied = requireWriteAccess(session, ["procurement"]);
  if (denied) return denied;
  const authSession = session!;

  const formData = await request.formData();
  const status = formData.get("status") as PoStatus;
  const cancelReason = formData.get("cancel_reason") as string | null;

  if (!status) {
    return NextResponse.json({ error: "Status is required" }, { status: 400 });
  }

  const supabase = createSupabaseClient();
  const poId = params.id;

  const { data: po } = await supabase
    .from("po")
    .select("supplier_name, po_number, status_history")
    .eq("id", poId)
    .single();

  if (!po) {
    return NextResponse.json({ error: "PO not found" }, { status: 404 });
  }

  const existingHistory = (po.status_history as Array<{ status: string; timestamp: string; changed_by: string; remarks?: string }>) || [];
  const newEntry = {
    status,
    timestamp: new Date().toISOString(),
    changed_by: authSession.email,
    remarks: status === "canceled" && cancelReason ? `Cancelled: ${cancelReason}` : `Status updated to ${status}`,
  };
  const updatedHistory = [...existingHistory, newEntry];

  await supabase
    .from("po")
    .update({
      status,
      status_history: updatedHistory,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  const financeEmails = await getUsersByRole("finance");
  const payload = {
    po_id: poId,
    po_number: po.po_number,
    message: `PO ${po.po_number || poId.slice(0, 8)} (${po.supplier_name || "supplier"}) status updated to ${status}`,
  };
  if (financeEmails.length > 0) {
    await notifyMultipleUsers(financeEmails, "po_status_changed", payload);
  } else {
    await createNotification("finance@example.com", "po_status_changed", payload);
  }

  return NextResponse.redirect(new URL("/dashboard/procurement/po", request.url));
}
