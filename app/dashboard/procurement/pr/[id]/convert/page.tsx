import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { getUserNames } from "@/lib/getUserName";
import type { Pr } from "@/types/workflows";
import Link from "next/link";
import PurchaseRequestSummary from "./PurchaseRequestSummary";
import ConvertPrToPoForm from "./ConvertPrToPoForm";

async function getPrDetails(prId: string) {
  const supabase = createSupabaseClient();
  const { data: pr } = await supabase.from("pr").select("*").eq("id", prId).maybeSingle();
  return pr as Pr | null;
}

async function getPrWithUserNames(prId: string) {
  const pr = await getPrDetails(prId);
  if (!pr) return null;

  // Collect all unique emails to fetch names for
  const emails: string[] = [];
  if (pr.created_by_email) emails.push(pr.created_by_email);
  if (pr.approved_by_email) emails.push(pr.approved_by_email);
  if (pr.finance_verified_by_email) emails.push(pr.finance_verified_by_email);

  // Fetch user names in a single query
  const userNames = await getUserNames(emails);

  return { pr, userNames };
}

export default async function ProcurementPrConvertPage({ params }: { params: { id: string } }) {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const result = await getPrWithUserNames(params.id);
  if (!result) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">PR not found.</p>
        <Link
          href="/dashboard/procurement"
          className="mt-4 text-xs font-medium text-gray-900 hover:text-gray-700"
        >
          ← Back to Procurement Dashboard
        </Link>
      </div>
    );
  }

  const { pr, userNames } = result;

  // Check both Approver approval AND Finance verification
  if (pr.approval_status !== "approved" || pr.finance_verification_status !== "verified") {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">
          This PR requires both Approver approval AND Finance verification before conversion to PO.
        </p>
        <div className="mt-3 space-y-1 text-xs text-gray-600">
          <p>
            <span className="font-medium">Approver Status:</span>{" "}
            <span className={`capitalize ${pr.approval_status === "approved" ? "text-green-600" : "text-yellow-600"}`}>
              {pr.approval_status}
            </span>
          </p>
          <p>
            <span className="font-medium">Finance Status:</span>{" "}
            <span className={`capitalize ${pr.finance_verification_status === "verified" ? "text-green-600" : "text-yellow-600"}`}>
              {pr.finance_verification_status}
            </span>
          </p>
        </div>
        <Link
          href="/dashboard/procurement"
          className="mt-4 inline-block text-xs font-medium text-gray-900 hover:text-gray-700"
        >
          ← Back to Procurement Dashboard
        </Link>
      </div>
    );
  }

  if (pr.po_created) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">
          A PO has already been created for this PR. It cannot be converted again.
        </p>
        <Link
          href="/dashboard/procurement"
          className="mt-4 text-xs font-medium text-gray-900 hover:text-gray-700"
        >
          ← Back to Procurement Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Convert PR to Purchase Order
              </h1>
              {pr.pr_number && (
                <p className="mt-1 text-sm text-gray-600">
                  PR Number:{" "}
                  <span className="font-semibold">{pr.pr_number}</span>
                </p>
              )}
            </div>
            <Link
              href="/dashboard/procurement/pr"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Purchase Requests
            </Link>
          </div>
        </div>

        {/* Content Grid - Side by Side Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: PR Summary */}
          <div className="lg:col-span-1">
            <PurchaseRequestSummary pr={pr} userNames={userNames} />
          </div>

          {/* Right Column: PO Creation Form */}
          <div className="lg:col-span-1">
            <ConvertPrToPoForm pr={pr} userEmail={session.email} />
          </div>
        </div>
      </div>
    </div>
  );
}
