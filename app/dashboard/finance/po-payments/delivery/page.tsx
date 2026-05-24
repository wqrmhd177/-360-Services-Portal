import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/session";
import type { Po } from "@/types/workflows";
import {
  errorMessages,
  getAllPos,
  isDeliveryPaymentEligibleStatus,
  markDeliveryPaymentPaidWithProofUrl,
  revertDeliveryPaymentToUnpaid,
  deleteDeliveryPaymentProof,
} from "../_shared";
import PoPaymentActions from "@/components/finance/PoPaymentActions";

type ViewFilter = "all" | "unpaid" | "paid";

function getViewFilter(raw: unknown): ViewFilter {
  if (raw === "all" || raw === "unpaid" || raw === "paid") return raw;
  return "unpaid";
}

function buildHref(view: ViewFilter, search: string) {
  const qs = new URLSearchParams();
  if (view !== "unpaid") qs.set("view", view);
  if (search) qs.set("search", search);
  const s = qs.toString();
  return s ? `/dashboard/finance/po-payments/delivery?${s}` : "/dashboard/finance/po-payments/delivery";
}

export default async function DeliveryPoPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; search?: string; view?: string }>;
}) {
  const session = getPortalSession();
  if (!session?.email) redirect("/auth/login");

  const params = await searchParams;
  const searchQuery = (params.search ?? "").trim().toLowerCase();
  const view = getViewFilter(params.view);
  const errorMsg = params.error ? errorMessages[params.error] ?? params.error : null;

  async function savePaidAction(formData: FormData) {
    "use server";
    await markDeliveryPaymentPaidWithProofUrl(formData, "/dashboard/finance/po-payments/delivery");
  }

  async function revertAction(formData: FormData) {
    "use server";
    await revertDeliveryPaymentToUnpaid(formData, "/dashboard/finance/po-payments/delivery");
  }

  async function deleteProofAction(formData: FormData) {
    "use server";
    await deleteDeliveryPaymentProof(formData, "/dashboard/finance/po-payments/delivery");
  }

  const pos = await getAllPos();

  const eligible = pos.filter((po) => isDeliveryPaymentEligibleStatus(po.status));

  const filtered = eligible.filter((po) => {
    if (!searchQuery) return true;
    const poNumber = (po.po_number ?? "").toLowerCase();
    return poNumber.includes(searchQuery);
  });

  const viewFiltered = filtered.filter((po) => {
    if (view === "all") return true;
    return po.delivery_partner_payment_status === view;
  });

  const unpaidCount = filtered.filter((p) => p.delivery_partner_payment_status === "unpaid").length;
  const paidCount = filtered.filter((p) => p.delivery_partner_payment_status === "paid").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Delivery Payments</h2>
          <p className="text-sm text-gray-500">POs become due when status reaches Delivered.</p>
        </div>
        <Link href="/dashboard/finance" className="text-xs text-gray-700 font-medium hover:text-gray-900">
          ← Back to Finance Dashboard
        </Link>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href={buildHref("unpaid", params.search ?? "")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                view === "unpaid"
                  ? "border-portal-400 bg-portal-50 text-portal-700"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Unpaid ({unpaidCount})
            </Link>
            <Link
              href={buildHref("paid", params.search ?? "")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                view === "paid"
                  ? "border-portal-400 bg-portal-50 text-portal-700"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Paid ({paidCount})
            </Link>
            <Link
              href={buildHref("all", params.search ?? "")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                view === "all"
                  ? "border-portal-400 bg-portal-50 text-portal-700"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              All ({filtered.length})
            </Link>
          </div>

          <form method="GET" action="/dashboard/finance/po-payments/delivery" className="flex items-center gap-2">
            {view !== "unpaid" && <input type="hidden" name="view" value={view} />}
            <div className="relative">
              <input
                type="text"
                name="search"
                defaultValue={params.search ?? ""}
                placeholder="Search PO number…"
                className="pl-3 pr-7 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-portal-400 focus:border-portal-400 w-56"
              />
              {searchQuery && (
                <Link
                  href={buildHref(view, "")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Link>
              )}
            </div>
          </form>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {errorMsg}
          </div>
        )}

        {viewFiltered.length === 0 ? (
          <p className="mt-4 text-xs text-gray-400">
            {searchQuery ? "No POs found for the current filters." : "No eligible POs yet."}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-2 py-2 font-medium text-center align-middle">PO Number</th>
                  <th className="px-2 py-2 font-medium text-center align-middle">Delivery Partner</th>
                  <th className="px-2 py-2 font-medium text-center align-middle">Tracking ID</th>
                  <th className="px-2 py-2 font-medium text-center align-middle">Status</th>
                  <th className="px-2 py-2 font-medium text-center align-middle">Delivery Payment</th>
                  <th className="px-2 py-2 font-medium text-center align-middle">Created</th>
                  <th className="px-2 py-2 font-medium text-center align-middle">Created by</th>
                </tr>
              </thead>
              <tbody>
                {viewFiltered.map((po: Po) => {
                  const pr = po.pr as any;
                  const creatorEmail = (pr?.created_by_email as string | undefined) ?? po.created_by_email;
                  const creatorLabel = creatorEmail ? creatorEmail.split("@")[0] || creatorEmail : null;

                  return (
                    <tr key={po.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-2 py-2 text-gray-900 text-center align-middle">
                        {po.po_number ? (
                          <span className="font-mono text-xs font-semibold text-gray-900">{po.po_number}</span>
                        ) : (
                          <span className="font-mono text-[10px] text-gray-400">{po.id.slice(0, 8)}...</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center align-middle text-gray-700">{po.delivery_partner}</td>
                      <td className="px-2 py-2 text-center align-middle text-gray-700">
                        {po.delivery_partner_tracking_id ? (
                          <span className="font-mono text-[10px] text-gray-700">{po.delivery_partner_tracking_id}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center align-middle">
                        <span className="badge capitalize">{(po?.status ?? "").replace(/_/g, " ") || "—"}</span>
                      </td>
                      <td className="px-2 py-2 text-center align-middle">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <span
                            className={`badge w-fit ${
                              po.delivery_partner_payment_status === "paid"
                                ? "border-green-500 bg-green-50 text-green-700"
                                : "border-red-500 bg-red-50 text-red-700"
                            }`}
                          >
                            {po.delivery_partner_payment_status === "paid" ? "Paid" : "Unpaid"}
                          </span>
                          <PoPaymentActions
                            poId={po.id}
                            kind="delivery"
                            actorEmail={session.email}
                            currentStatus={po.delivery_partner_payment_status}
                            currentProofUrl={po.delivery_partner_payment_proof}
                            onSave={savePaidAction}
                            onRevert={revertAction}
                            onDeleteProof={deleteProofAction}
                          />
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center align-middle text-gray-500">
                        {po.created_at
                          ? new Date(po.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : "-"}
                      </td>
                      <td className="px-2 py-2 text-center align-middle text-gray-700">
                        {creatorLabel ? creatorLabel : <span className="text-gray-400">-</span>}
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
  );
}

