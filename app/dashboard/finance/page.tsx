import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import type { Pr, Po } from "@/types/workflows";

async function getFinanceData() {
  const supabase = createSupabaseClient();

  const [{ data: prsPendingVerification }, { data: allPrs }, { data: allPos }] = await Promise.all([
    supabase
      .from("pr")
      .select("*")
      .eq("approval_status", "approved")
      .neq("pr_status", "awaiting_payment")
      .eq("finance_verification_status", "pending")
      .order("created_at", { ascending: false }),
    supabase.from("pr").select("id, finance_verification_status").then((r) => r),
    supabase
      .from("po")
      .select("*")
      .order("created_at", { ascending: false })
  ]);

  return {
    prsPendingVerification: (prsPendingVerification ?? []) as Pr[],
    allPrs: (allPrs ?? []) as Pr[],
    allPos: (allPos ?? []) as Po[]
  };
}

export default async function FinanceDashboardPage() {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const { prsPendingVerification, allPrs, allPos } = await getFinanceData();

  const verifiedCount = allPrs.filter((p) => p.finance_verification_status === "verified").length;
  const pendingVerificationCount = prsPendingVerification.length;

  const unpaidSupplierPos = allPos.filter((po) => po.supplier_payment_status === "unpaid").length;
  const unpaidDeliveryPos = allPos.filter(
    (po) => po.delivery_partner_payment_status === "unpaid"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Finance Workspace</h2>
        <p className="text-sm text-gray-500">
          Verify PR payments by uploading payment proofs, and track Supplier and Delivery Partner
          payment statuses across all Purchase Orders.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="card border-l-4 border-blue-500 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Pending Verification
            </div>
          </div>
          <div className="text-4xl font-bold text-blue-600">{pendingVerificationCount}</div>
          <p className="mt-2 text-sm text-gray-600">PRs awaiting payment verification</p>
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
          <div className="text-4xl font-bold text-green-600">{verifiedCount}</div>
          <p className="mt-2 text-sm text-gray-600">Total verified PRs</p>
        </div>
        <div className="card border-l-4 border-amber-500 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Unpaid Suppliers
            </div>
          </div>
          <div className="text-4xl font-bold text-amber-600">{unpaidSupplierPos}</div>
          <p className="mt-2 text-sm text-gray-600">POs with unpaid supplier invoices</p>
        </div>
        <div className="card border-l-4 border-purple-500 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Unpaid Delivery Partners
            </div>
          </div>
          <div className="text-4xl font-bold text-purple-600">{unpaidDeliveryPos}</div>
          <p className="mt-2 text-sm text-gray-600">POs with unpaid delivery invoices</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">PRs Pending Verification</h3>
              <p className="text-xs text-gray-400">
                Approved PRs waiting for payment verification and proof upload.
              </p>
            </div>
          </div>
          {prsPendingVerification.length === 0 ? (
            <p className="text-xs text-gray-400">No PRs pending verification at this time.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="px-2 py-2 font-medium">PR Number</th>
                    <th className="px-2 py-2 font-medium">Product</th>
                    <th className="px-2 py-2 font-medium">Amount</th>
                    <th className="px-2 py-2 font-medium">Payment</th>
                    <th className="px-2 py-2 font-medium">Created</th>
                    <th className="px-2 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {prsPendingVerification.map((pr) => {
                    const products = pr.products || [];
                    const totalAmount = products.length > 0
                      ? products.reduce((sum, p) => sum + p.totalAmount, 0)
                      : pr.amount ?? 0;
                    const currency = products.length > 0 ? products[0].currency : "AED";
                    const productLabel = products.length > 0
                      ? products.length === 1
                        ? products[0].productName
                        : `${products[0].productName} (+${products.length - 1} more)`
                      : pr.product_name || "-";
                    return (
                      <tr key={pr.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-2 py-2 font-mono text-xs font-semibold text-gray-900">
                          {pr.pr_number || "-"}
                        </td>
                        <td className="px-2 py-2 text-gray-900 font-medium">{productLabel}</td>
                        <td className="px-2 py-2 text-gray-700">
                          {currency} {typeof totalAmount === "number" ? totalAmount.toFixed(2) : totalAmount}
                        </td>
                        <td className="px-2 py-2 text-gray-700 capitalize">
                          {pr.payment_type || pr.payment_method || "-"}
                        </td>
                        <td className="px-2 py-2 text-gray-500">
                          {pr.created_at
                            ? new Date(pr.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric"
                              })
                            : "-"}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Link
                            href={`/dashboard/finance/pr/${pr.id}`}
                            className="text-xs font-medium text-gray-900 hover:text-gray-700"
                          >
                            Verify Payment
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
            <h3 className="text-sm font-semibold text-gray-900">PO Payment Overview</h3>
            <p className="text-xs text-gray-400">
              Quick view of payment statuses across all Purchase Orders.
            </p>
          </div>
          {allPos.length === 0 ? (
            <p className="text-xs text-gray-400">No Purchase Orders yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 text-xs font-medium text-gray-500">Total POs</div>
                <div className="text-lg font-semibold text-gray-900">{allPos.length}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-200 bg-white p-2">
                  <div className="text-[10px] text-gray-500">Supplier Paid</div>
                  <div className="text-sm font-semibold text-green-600">
                    {allPos.filter((po) => po.supplier_payment_status === "paid").length}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-2">
                  <div className="text-[10px] text-gray-500">Delivery Paid</div>
                  <div className="text-sm font-semibold text-green-600">
                    {allPos.filter((po) => po.delivery_partner_payment_status === "paid").length}
                  </div>
                </div>
              </div>
              <Link
                href="/dashboard/finance/po-payments/supplier"
                className="block text-center text-xs font-medium text-gray-900 hover:text-gray-700"
              >
                View All PO Payments →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

