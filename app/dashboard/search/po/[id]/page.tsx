import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import type { Po, PoStatus, PoStatusHistoryEntry } from "@/types/workflows";
import ProcurementImagesSection from "@/components/ProcurementImagesSection";
import PODownloadButton from "@/components/PODownloadButton";

async function getPoDetails(poId: string) {
  const supabase = createSupabaseClient();
  const [
    { data: po },
    { data: profiles },
    { data: prs }
  ] = await Promise.all([
    supabase.from("po").select("*").eq("id", poId).maybeSingle(),
    supabase.from("profiles").select("email, full_name"),
    supabase.from("pr").select("id, pr_number")
  ]);

  const emailToNameMap = new Map(
    (profiles ?? []).map((p: { email: string; full_name: string }) => [p.email, p.full_name])
  );
  const prMap = new Map(
    (prs ?? []).map((pr: { id: string; pr_number: string }) => [pr.id, pr.pr_number])
  );
  const prNumber = po?.pr_id ? prMap.get(po.pr_id) : null;

  return { po: po as Po | null, emailToNameMap, prNumber };
}

const statusLabels: Record<PoStatus, string> = {
  order_placed: "Order Placed",
  po_created: "Processing",
  shipment_at_supplier: "Shipment At Supplier WH",
  shipment_received_at_supplier_warehouse: "Shipment Received At Supplier Warehouse",
  shipment_received_at_lp_warehouse: "Shipment Received At LMP Warehouse",
  shipment_received_at_destination_city: "Shipment Received At Destination City",
  shipment_received_at_destination_warehouse: "Shipment At Destination Country",
  delivered: "Delivered",
  canceled: "Canceled"
};

export default async function SearchPOViewPage({ params }: { params: { id: string } }) {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const { po, emailToNameMap, prNumber } = await getPoDetails(params.id);
  if (!po) {
    return (
      <div className="space-y-4">
        <div className="card">
          <p className="text-sm text-gray-500">PO not found.</p>
          <Link href="/dashboard" className="mt-4 text-xs font-medium text-gray-900 hover:text-gray-700">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">PO Details (View Only)</h2>
          {po.po_number && (
            <span className="rounded-lg border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs font-mono font-semibold text-gray-900">
              {po.po_number}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <PODownloadButton po={po} prNumber={prNumber} />
          <Link href="/dashboard" className="text-xs text-gray-700 font-medium hover:text-gray-900">
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">PO Information</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-0.5">
            <label className="text-xs font-medium text-gray-500">Current Status</label>
            <div>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                {statusLabels[po.status]}
              </span>
            </div>
          </div>
          <div className="space-y-0.5">
            <label className="text-xs font-medium text-gray-500">PO Type</label>
            <div className="text-sm text-gray-900 capitalize">{po.po_type}</div>
          </div>
          <div className="space-y-0.5">
            <label className="text-xs font-medium text-gray-500">PR Number</label>
            <div className="font-mono text-xs font-semibold text-gray-900">{prNumber || "-"}</div>
          </div>
          <div className="space-y-0.5">
            <label className="text-xs font-medium text-gray-500">Supplier</label>
            <div className="text-sm text-gray-900">{po.supplier_name}</div>
          </div>
          <div className="space-y-0.5">
            <label className="text-xs font-medium text-gray-500">Supplier Location</label>
            <div className="text-sm text-gray-900">{po.supplier_location}</div>
          </div>
          <div className="space-y-0.5">
            <label className="text-xs font-medium text-gray-500">Supplier Payment</label>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  po.supplier_payment_status === "paid"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {po.supplier_payment_status === "paid" ? "Paid" : "Unpaid"}
              </span>
              {po.supplier_payment_status === "paid" && po.supplier_payment_proof && (
                <a
                  href={po.supplier_payment_proof}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  Download payment proof
                </a>
              )}
            </div>
          </div>
          <div className="space-y-0.5">
            <label className="text-xs font-medium text-gray-500">Delivery Partner</label>
            <div className="text-sm text-gray-900">{po.delivery_partner}</div>
          </div>
          <div className="space-y-0.5">
            <label className="text-xs font-medium text-gray-500">Tracking ID</label>
            <div className="text-sm text-gray-900">{po.delivery_partner_tracking_id}</div>
          </div>
          <div className="space-y-0.5">
            <label className="text-xs font-medium text-gray-500">Delivery Payment</label>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  po.delivery_partner_payment_status === "paid"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {po.delivery_partner_payment_status === "paid" ? "Paid" : "Unpaid"}
              </span>
              {po.delivery_partner_payment_status === "paid" && po.delivery_partner_payment_proof && (
                <a
                  href={po.delivery_partner_payment_proof}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  Download payment proof
                </a>
              )}
            </div>
          </div>
          {po.created_by_email && (
            <div className="space-y-0.5">
              <label className="text-xs font-medium text-gray-500">Created By</label>
              <div className="text-sm text-gray-900">
                {emailToNameMap.get(po.created_by_email) ?? po.created_by_email.split("@")[0]}
              </div>
            </div>
          )}
          {po.created_at && (
            <div className="space-y-0.5">
              <label className="text-xs font-medium text-gray-500">Created At</label>
              <div className="text-sm text-gray-900">
                {new Date(po.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </div>
            </div>
          )}
          {po.remarks && (
            <div className="md:col-span-3 space-y-0.5">
              <label className="text-xs font-medium text-gray-500">Remarks</label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm text-gray-900">
                {po.remarks}
              </div>
            </div>
          )}
          {po.status_history && Array.isArray(po.status_history) && po.status_history.length > 0 && (
            <div className="md:col-span-3 space-y-0.5">
              <label className="text-xs font-medium text-gray-500">Status History</label>
              <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-32 overflow-y-auto">
                {(po.status_history as PoStatusHistoryEntry[]).map((entry, idx) => {
                  const userName = emailToNameMap.get(entry.changed_by) || entry.changed_by;
                  return (
                    <div key={idx} className="px-2 py-1.5 text-xs flex flex-wrap gap-2 items-center">
                      <span className="font-medium text-gray-900">
                        {statusLabels[entry?.status as PoStatus] || (entry?.status ?? "").replace(/_/g, " ") || "—"}
                      </span>
                      <span className="text-gray-500">
                        {entry.timestamp
                          ? new Date(entry.timestamp).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })
                          : "-"}
                      </span>
                      <span className="text-gray-500">by {userName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <ProcurementImagesSection poId={po.id} variant="card" />
    </div>
  );
}
