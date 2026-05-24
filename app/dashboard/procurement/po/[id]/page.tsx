import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import type { Po, PoStatus, PoStatusHistoryEntry } from "@/types/workflows";
import POStatusUpdateForm from "@/components/POStatusUpdateForm";
import { uploadPoInvoice } from "@/lib/poUploads";
import { PoPaymentAndInvoiceEditForm } from "@/components/PoPaymentAndInvoiceEditForm";


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

  // Create email to name map
  const emailToNameMap = new Map(
    (profiles ?? []).map((p: any) => [p.email, p.full_name])
  );

  // Create PR ID to PR number map
  const prMap = new Map(
    (prs ?? []).map((pr: any) => [pr.id, pr.pr_number])
  );

  const prNumber = po?.pr_id ? prMap.get(po.pr_id) : null;

  return { po: po as Po | null, emailToNameMap, prNumber };
}

async function updatePoPaymentAndInvoices(formData: FormData) {
  "use server";

  const poId = formData.get("poId") as string | null;
  if (!poId) {
    redirect("/dashboard/procurement/po");
  }

  const supplierPaymentAmountRaw = (formData.get(
    "supplier_payment_amount"
  ) as string | null)?.trim();
  const deliveryPaymentAmountRaw = (formData.get(
    "delivery_partner_payment_amount"
  ) as string | null)?.trim();
  const trackingIdRaw = (formData.get(
    "delivery_partner_tracking_id"
  ) as string | null)?.trim();

  const supplierInvoiceFile = formData.get(
    "supplier_invoice_file"
  ) as File | null;
  const deliveryInvoiceFile = formData.get(
    "delivery_partner_invoice_file"
  ) as File | null;

  const updates: Record<string, unknown> = {};

  // Only update payment amounts when a non-empty value is submitted,
  // so we don't accidentally clear existing amounts.
  if (supplierPaymentAmountRaw !== undefined && supplierPaymentAmountRaw !== "") {
    const value = Number(supplierPaymentAmountRaw);
    if (!Number.isNaN(value)) {
      updates.supplier_payment_amount = value;
    }
  }

  if (deliveryPaymentAmountRaw !== undefined && deliveryPaymentAmountRaw !== "") {
    const value = Number(deliveryPaymentAmountRaw);
    if (!Number.isNaN(value)) {
      updates.delivery_partner_payment_amount = value;
    }
  }

  // Only update tracking ID when a non-empty value is submitted.
  // Empty input now means "leave as is" instead of clearing.
  if (trackingIdRaw !== undefined && trackingIdRaw !== "") {
    updates.delivery_partner_tracking_id = trackingIdRaw;
  }

  if (supplierInvoiceFile && supplierInvoiceFile.size > 0) {
    const url = await uploadPoInvoice(supplierInvoiceFile, poId, "supplier");
    updates.supplier_invoice_file = url;
  }

  if (deliveryInvoiceFile && deliveryInvoiceFile.size > 0) {
    const url = await uploadPoInvoice(deliveryInvoiceFile, poId, "delivery");
    updates.delivery_partner_invoice_file = url;
  }

  if (Object.keys(updates).length === 0) {
    redirect(`/dashboard/procurement/po/${poId}`);
  }

  updates.updated_at = new Date().toISOString();

  const supabase = createSupabaseClient();
  await supabase
    .from("po")
    .update(updates)
    .eq("id", poId);

  redirect(`/dashboard/procurement/po/${poId}`);
}

const statusOptions: PoStatus[] = [
  "order_placed",
  "po_created",
  "shipment_at_supplier",
  "shipment_received_at_lp_warehouse",
  "shipment_received_at_destination_warehouse",
  "delivered",
  "canceled"
];

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

export default async function ProcurementPoDetailPage({ params }: { params: { id: string } }) {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const { po, emailToNameMap, prNumber } = await getPoDetails(params.id);
  if (!po) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">PO not found.</p>
        <Link
          href="/dashboard/procurement/po"
          className="mt-4 text-xs font-medium text-gray-900 hover:text-gray-700"
        >
          ← Back to Purchase Orders
        </Link>
      </div>
    );
  }

  const canProgress = po.status !== "canceled";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">PO Details</h2>
          {po.po_number && (
            <span className="rounded-lg border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs font-mono font-semibold text-gray-900">
              {po.po_number}
            </span>
          )}
        </div>
        <Link href="/dashboard/procurement/po" className="text-xs text-gray-700 font-medium hover:text-gray-900">
          ← Back
        </Link>
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
            <div className="font-mono text-xs font-semibold text-gray-900">
              {po.pr_id ? (prNumber || po.pr_id.slice(0, 8)) : "Independent"}
            </div>
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
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
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
            <div className="text-sm text-gray-900">
              {po.delivery_partner_tracking_id || "—"}
            </div>
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
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
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
                      <span className="font-medium text-gray-900">{statusLabels[entry?.status as PoStatus] || (entry?.status ?? "").replace(/_/g, " ") || "—"}</span>
                      <span className="text-gray-500">
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                      </span>
                      <span className="text-gray-500">by {userName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {po.products && Array.isArray(po.products) && po.products.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Products</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left text-gray-700">
                <thead className="border-b border-gray-200 text-gray-600">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Product</th>
                    <th className="py-2 pr-3 font-medium">SKU</th>
                    <th className="py-2 pr-3 font-medium">Qty</th>
                    <th className="py-2 pr-3 font-medium">Rate</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {po.products.map((item: { productName?: string; product_name?: string; skuCode?: string; quantity?: number; rate?: number; amount?: number }, idx: number) => (
                    <tr key={idx} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-3 font-medium text-gray-900">{item.productName ?? item.product_name ?? "—"}</td>
                      <td className="py-2 pr-3">{item.skuCode ?? "—"}</td>
                      <td className="py-2 pr-3">{item.quantity ?? "—"}</td>
                      <td className="py-2 pr-3">{item.rate != null ? Number(item.rate) : "—"}</td>
                      <td className="py-2 pr-3">{item.amount != null ? Number(item.amount) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <PoPaymentAndInvoiceEditForm po={po} action={updatePoPaymentAndInvoices} />

      {canProgress && (
        <div className="card">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Update Status</h3>
          <POStatusUpdateForm
            poId={po.id}
            currentStatus={po.status}
            statusOptions={statusOptions}
            statusLabels={statusLabels}
          />
        </div>
      )}

      {!canProgress && (
        <div className="card">
          <p className="text-sm text-gray-500">
            This PO is cancelled and cannot be updated further.
          </p>
        </div>
      )}
    </div>
  );
}
