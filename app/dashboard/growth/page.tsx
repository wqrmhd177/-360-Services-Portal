import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import type { Pr, Qr } from "@/types/workflows";
import GrowthDashboardWrapper from "@/components/GrowthDashboardWrapper";

/** Add N working days (Mon–Fri) to a date. */
function addWorkingDays(fromDate: Date, workingDays: number): Date {
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);
  let added = 0;
  while (added < workingDays) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

/** True if still within 3 working days of last response/re-edit (rates valid); after that reconfirm required. */
function canConvertQrToPr(qr: Qr): boolean {
  if (qr.status !== "responded") return false;
  const updatedAt = qr.updated_at;
  if (!updatedAt) return true;
  const from = new Date(updatedAt);
  const eligibleFrom = addWorkingDays(from, 3);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eligibleFrom.setHours(0, 0, 0, 0);
  return today < eligibleFrom;
}

async function getGrowthData(session: { email: string; isAdmin?: boolean }) {
  const supabase = createSupabaseClient();
  const filterByEmail = !session.isAdmin;

  const qrChain = filterByEmail
    ? supabase.from("qr").select("id, qr_number, purchase_details, countries, shipping_type, procurement_response, status, created_at, updated_at").eq("created_by_email", session.email).order("created_at", { ascending: false })
    : supabase.from("qr").select("id, qr_number, purchase_details, countries, shipping_type, procurement_response, status, created_at, updated_at").order("created_at", { ascending: false });
  const prChain = filterByEmail
    ? supabase.from("pr").select("id, pr_number, product_name, amount, approval_status, finance_verification_status, created_at").eq("created_by_email", session.email).order("created_at", { ascending: false })
    : supabase.from("pr").select("id, pr_number, product_name, amount, approval_status, finance_verification_status, created_at").order("created_at", { ascending: false });

  const [{ data: qrsData }, { data: prsData }] = await Promise.all([qrChain, prChain]);

  return {
    qrs: (qrsData ?? []) as Qr[],
    prs: (prsData ?? []) as Pr[]
  };
}

export default async function GrowthDashboardPage() {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const { qrs, prs } = await getGrowthData(session);

  const qrOpen = qrs.filter((q) => q.status === "open").length;
  const qrResponded = qrs.filter((q) => q.status === "responded").length;
  const qrConverted = qrs.filter((q) => q.status === "converted_to_pr").length;

  const prPendingApproval = prs.filter((p) => p.approval_status === "pending").length;
  const prApproved = prs.filter((p) => p.approval_status === "approved").length;
  const prPendingFinance = prs.filter(
    (p) => p.approval_status === "approved" && p.finance_verification_status === "pending"
  ).length;
  const prFinanceVerified = prs.filter((p) => p.finance_verification_status === "verified").length;

  const qrReadyForPr = qrs.filter((q) => q.status === "responded");

  return (
    <GrowthDashboardWrapper>
      <div className="space-y-8">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Growth Workspace</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/growth/qr" className="btn-primary shadow-lg hover:shadow-xl transition-all">
              <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New QR
            </Link>
            <Link
              href="/dashboard/growth/pr/new?service=Movements"
              className="inline-flex items-center px-4 py-2 border border-indigo-300 rounded-md shadow-sm text-sm font-medium text-indigo-800 bg-indigo-50 hover:bg-indigo-100 transition-all"
            >
              <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              New Movement PR
            </Link>
          </div>
        </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="card border-l-4 border-blue-500 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Open QRs
            </div>
          </div>
          <div className="text-4xl font-bold text-blue-600">{qrOpen}</div>
          <p className="mt-2 text-sm text-gray-600">Waiting for Procurement response</p>
        </div>
        <div className="card border-l-4 border-green-500 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Responded QRs
            </div>
          </div>
          <div className="text-4xl font-bold text-green-600">{qrResponded}</div>
          <p className="mt-2 text-sm text-gray-600">Ready to be converted into PRs</p>
        </div>
        <div className="card border-l-4 border-purple-500 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              QRs Converted to PR
            </div>
          </div>
          <div className="text-4xl font-bold text-purple-600">{qrConverted}</div>
          <p className="mt-2 text-sm text-gray-600">Already moved into PR workflow</p>
        </div>
        <div className="card border-l-4 border-emerald-500 hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              PRs Approved / Finance Verified
            </div>
          </div>
          <div className="text-4xl font-bold text-emerald-600">
            {prApproved} / {prFinanceVerified}
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Approved PRs, and those verified by Finance
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr,1fr]">
        <div className="card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Responded QRs ready for PR conversion
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                Once Procurement has responded, convert the QR into a structured PR.
              </p>
            </div>
          </div>
          {qrReadyForPr.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-6 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="mt-2 text-sm text-gray-600">
                No responded QRs yet. You&apos;ll see them here once Procurement sends a response.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="min-w-full text-center text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-3 py-3 font-semibold">QR Number</th>
                    <th className="px-3 py-3 font-semibold">Product</th>
                    <th className="px-3 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {qrReadyForPr.map((qr, idx) => (
                    <tr key={qr.id} className={`border-b border-gray-100 last:border-0 hover:bg-blue-50 hover:shadow-sm transition-all ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-3 py-3">
                        {qr.qr_number ? (
                          <span className="font-mono text-sm font-semibold text-gray-900">{qr.qr_number}</span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-900">
                        {qr.purchase_details && qr.purchase_details.length > 0
                          ? qr.purchase_details.map((d: any) => d.productName).join(", ")
                          : "-"}
                      </td>
                      <td className="px-3 py-3">
                        {canConvertQrToPr(qr) ? (
                          <Link
                            href={`/dashboard/growth/qr/${qr.id}/convert`}
                            className="inline-flex items-center rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 transition-colors"
                          >
                            Convert to PR
                          </Link>
                        ) : (
                          <span className="inline-flex items-center rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800" title="Rates valid for 3 working days. After that, reconfirm rates with Procurement before converting to PR.">
                            Reconfirm Rates
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="mb-4 text-base font-bold text-gray-900">PR pipeline snapshot</h3>
          <ul className="space-y-3 text-sm text-gray-700">
            <li className="flex items-center justify-between rounded-lg bg-orange-50 p-3 transition-all hover:bg-orange-100">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500"></span>
                <span className="font-medium">Waiting for approval</span>
              </div>
              <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700 border border-orange-200">
                {prPendingApproval}
              </span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-yellow-50 p-3 transition-all hover:bg-yellow-100">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500"></span>
                <span className="font-medium">Approved, pending Finance verification</span>
              </div>
              <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700 border border-yellow-200">
                {prPendingFinance}
              </span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-green-50 p-3 transition-all hover:bg-green-100">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
                <span className="font-medium">Finance verified</span>
              </div>
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 border border-green-200">
                {prFinanceVerified}
              </span>
            </li>
          </ul>
          <div className="mt-4 rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-600">
              Detailed approval and finance views will be available in the Approver and Finance
              dashboards once those flows are wired in.
            </p>
          </div>
        </div>
      </div>
      </div>
    </GrowthDashboardWrapper>
  );
}

