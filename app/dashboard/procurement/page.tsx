import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getProcurementPOs } from "@/lib/procurementPos";
import { getPortalSession } from "@/lib/session";
import type { Qr, Pr, Po, PoStatus } from "@/types/workflows";
import ProcurementDashboardWrapper from "@/components/ProcurementDashboardWrapper";

async function getProcurementData() {
  const supabase = createSupabaseClient();

  const [
    { data: openQrs },
    { data: verifiedPrs },
    { data: profiles }
  ] = await Promise.all([
    supabase
      .from("qr")
      .select("id, qr_number, purchase_details, countries, shipping_type, status, created_at, created_by_email")
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    supabase
      .from("pr")
      .select("id, pr_number, product_name, products, created_by_email, finance_verification_status, po_created, created_at")
      .eq("finance_verification_status", "verified")
      .eq("po_created", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("email, full_name")
  ]);

  // Single source of truth: same PO list as "Purchase Orders" sidebar page
  const allPos = await getProcurementPOs();

  // Create a map of email to full name
  const emailToNameMap = new Map(
    (profiles ?? []).map((p: any) => [p.email, p.full_name])
  );

  // Add full names to QRs and PRs
  const enrichedQrs = (openQrs ?? []).map((qr: any) => ({
    ...qr,
    creator_name: emailToNameMap.get(qr.created_by_email) || qr.created_by_email
  }));

  const enrichedPrs = (verifiedPrs ?? []).map((pr: any) => ({
    ...pr,
    creator_name: emailToNameMap.get(pr.created_by_email) || pr.created_by_email
  }));

  return {
    openQrs: enrichedQrs as Qr[],
    verifiedPrs: enrichedPrs as Pr[],
    allPos
  };
}

function getPoStatusCounts(pos: Po[]) {
  const statuses: PoStatus[] = [
    "order_placed",
    "shipment_at_supplier",
    "shipment_received_at_lp_warehouse",
    "shipment_received_at_destination_city",
    "shipment_received_at_destination_warehouse",
    "delivered",
    "canceled"
  ];
  return statuses.reduce((acc, status) => {
    acc[status] = pos.filter((po) => po.status === status).length;
    return acc;
  }, {} as Record<PoStatus, number>);
}

export default async function ProcurementDashboardPage() {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const { openQrs, verifiedPrs, allPos } = await getProcurementData();
  const statusCounts = getPoStatusCounts(allPos);

  return (
    <ProcurementDashboardWrapper>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Procurement Workspace</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/procurement/po/new" className="btn-primary">
              New PO
            </Link>
          </div>
        </div>

      <div className="grid gap-6 md:grid-cols-5">
        <div className="card border-l-4 border-blue-500 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Open QRs
            </div>
          </div>
          <div className="text-4xl font-bold text-blue-600">{openQrs.length}</div>
          <p className="mt-2 text-sm text-gray-600">Awaiting response</p>
        </div>
        <div className="card border-l-4 border-green-500 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Verified PRs
            </div>
          </div>
          <div className="text-4xl font-bold text-green-600">{verifiedPrs.length}</div>
          <p className="mt-2 text-sm text-gray-600">Ready for PO conversion</p>
        </div>
        <div className="card border-l-4 border-purple-500 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8 4-8-4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Order Placed
            </div>
          </div>
          <div className="text-4xl font-bold text-purple-600">{statusCounts.order_placed}</div>
          <p className="mt-2 text-sm text-gray-600">POs at initial stage</p>
        </div>
        <div className="card border-l-4 border-amber-500 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              In Transit
            </div>
          </div>
          <div className="text-4xl font-bold text-amber-600">
            {statusCounts.shipment_at_supplier +
              statusCounts.shipment_received_at_lp_warehouse +
              statusCounts.shipment_received_at_destination_city +
              statusCounts.shipment_received_at_destination_warehouse}
          </div>
          <p className="mt-2 text-sm text-gray-600">POs in shipment</p>
        </div>
        <div className="card border-l-4 border-emerald-500 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">Delivered</div>
          </div>
          <div className="text-4xl font-bold text-emerald-600">{statusCounts.delivered}</div>
          <p className="mt-2 text-sm text-gray-600">Completed POs</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Open QRs Awaiting Response</h3>
              <p className="text-xs text-gray-400">
                Respond to Growth Team&apos;s quotation requests with pricing and timelines.
              </p>
            </div>
          </div>
          {openQrs.length === 0 ? (
            <p className="text-xs text-gray-400">No open QRs at this time.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="px-2 py-2 font-medium">QR ID</th>
                    <th className="px-2 py-2 font-medium">Product</th>
                    <th className="px-2 py-2 font-medium">Growth User</th>
                    <th className="px-2 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {openQrs.map((qr: any) => {
                    const productNames = qr.purchase_details && Array.isArray(qr.purchase_details) && qr.purchase_details.length > 0
                      ? qr.purchase_details.map((d: any) => d.productName).join(", ")
                      : "-";
                    const creatorName = qr.creator_name || "-";

                    return (
                      <tr key={qr.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-2 py-2">
                          <span className="font-mono text-xs font-semibold text-gray-900">
                            {qr.qr_number || "-"}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-gray-900">{productNames}</td>
                        <td className="px-2 py-2 text-gray-900">{creatorName}</td>
                        <td className="px-2 py-2 text-right">
                          <Link
                            href={`/dashboard/procurement/qr/${qr.id}/respond`}
                            className="text-xs font-medium text-gray-900 hover:text-gray-700"
                          >
                            Respond
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Finance-Verified PRs Ready for PO
            </h3>
            <p className="text-xs text-gray-400">
              Convert verified PRs into Purchase Orders with supplier and delivery partner details.
            </p>
          </div>
          {verifiedPrs.length === 0 ? (
            <p className="text-xs text-gray-400">
              No finance-verified PRs available. PRs must be approved and finance-verified before
              PO creation.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="px-2 py-2 font-medium">PR ID</th>
                    <th className="px-2 py-2 font-medium">Product</th>
                    <th className="px-2 py-2 font-medium">Growth User</th>
                    <th className="px-2 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {verifiedPrs.map((pr: any) => {
                    // Get product names - support both multi-product and single-product PRs
                    let productNames = "-";
                    if (pr.products && Array.isArray(pr.products) && pr.products.length > 0) {
                      productNames = pr.products.map((p: any) => p.productName).join(", ");
                    } else if (pr.product_name) {
                      productNames = pr.product_name;
                    }

                    const creatorName = pr.creator_name || "-";

                    return (
                      <tr key={pr.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-2 py-2">
                          <span className="font-mono text-xs font-semibold text-gray-900">
                            {pr.pr_number || "-"}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-gray-900">{productNames}</td>
                        <td className="px-2 py-2 text-gray-900">{creatorName}</td>
                        <td className="px-2 py-2 text-right">
                          <Link
                            href={`/dashboard/procurement/pr/${pr.id}/convert`}
                            className="text-xs font-medium text-gray-900 hover:text-gray-700"
                          >
                            Convert to PO
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">All Purchase Orders</h3>
          <Link
            href="/dashboard/procurement/po"
            className="text-xs text-gray-900 hover:text-gray-700"
          >
            View All POs →
          </Link>
        </div>
        {allPos.length === 0 ? (
          <p className="text-xs text-gray-400">No Purchase Orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-2 py-2 font-medium">PO Number</th>
                  <th className="px-2 py-2 font-medium">Product</th>
                  <th className="px-2 py-2 font-medium">Growth User</th>
                  <th className="px-2 py-2 font-medium">Supplier</th>
                  <th className="px-2 py-2 font-medium">Delivery Partner</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Created</th>
                  <th className="px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {allPos.map((po: any) => (
                  <tr key={po.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-2 py-2 text-gray-900">
                      {po.po_number ? (
                        <span className="font-mono text-xs font-semibold text-gray-900">{po.po_number}</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-gray-900">{po.product_names || "-"}</td>
                    <td className="px-2 py-2 text-gray-900">{po.creator_name || "-"}</td>
                    <td className="px-2 py-2 text-gray-900">{po.supplier_name}</td>
                    <td className="px-2 py-2 text-gray-900">{po.delivery_partner}</td>
                    <td className="px-2 py-2">
                      <span className="badge capitalize">{(po?.status ?? "").replace(/_/g, " ") || "—"}</span>
                    </td>
                    <td className="px-2 py-2 text-gray-500">
                      {po.created_at
                        ? new Date(po.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric"
                          })
                        : "-"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Link
                        href={`/dashboard/procurement/po/${po.id}`}
                        className="text-xs font-medium text-gray-900 hover:text-gray-700"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </ProcurementDashboardWrapper>
  );
}
