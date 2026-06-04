import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import type { Pr } from "@/types/workflows";
import PRDetailCard from "@/components/PRDetailCard";
import { canEditGrowthPr } from "@/lib/growthPrAccess";

interface PageProps {
  params: {
    id: string;
  };
}

async function getPR(id: string, session: { email: string; isAdmin?: boolean }) {
  const supabase = createSupabaseClient();
  let query = supabase.from("pr").select("*").eq("id", id);
  if (!session.isAdmin) {
    query = query.eq("created_by_email", session.email);
  }
  const { data: pr } = await query.single();
  return pr as Pr | null;
}

export default async function GrowthPRViewPage({ params }: PageProps) {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  if (session.role !== "growth" && !session.isAdmin) {
    redirect("/dashboard");
  }

  const pr = await getPR(params.id, session);

  if (!pr) {
    redirect("/dashboard/growth/purchase-requests");
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Purchase Request Details
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              View your PR details and track its approval status
            </p>
          </div>
          <Link
            href="/dashboard/growth/purchase-requests"
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
            Back to PR List
          </Link>
        </div>

        {/* PR Detail Card */}
        <PRDetailCard pr={pr} showFullDetails={true} />

        {/* Status-specific messages */}
        {pr.approval_status === "pending" && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <svg
                className="h-5 w-5 text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Pending Approval
                </h3>
                <p className="mt-1 text-sm text-yellow-700">
                  {"Your PR is awaiting approval from the Approver team. You'll be notified once a decision is made."}
                </p>
              </div>
            </div>
          </div>
        )}

        {pr.finance_verification_status === "rejected" && pr.approval_status === "approved" && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Finance Rejected</h3>
                <p className="mt-1 text-sm text-red-700">
                  Finance rejected this PR. You can reopen it from the list, or edit and resubmit details.
                </p>
                {canEditGrowthPr(pr) && (
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/dashboard/growth/pr/${pr.id}/edit`}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                    >
                      Edit and Resubmit
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {pr.approval_status === "pending" && canEditGrowthPr(pr) && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              This PR is pending approval. You can still update details before a decision is made.
            </p>
            <Link
              href={`/dashboard/growth/pr/${pr.id}/edit`}
              className="mt-3 inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-yellow-700 hover:bg-yellow-800"
            >
              Edit PR
            </Link>
          </div>
        )}

        {pr.approval_status === "rejected" && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <svg
                className="h-5 w-5 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">PR Rejected</h3>
                <p className="mt-1 text-sm text-red-700">
                  Your PR has been rejected. You can edit and resubmit it.
                </p>
                <div className="mt-3">
                  <Link
                    href={`/dashboard/growth/pr/${pr.id}/edit`}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                  >
                    Edit and Resubmit
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {pr.approval_status === "approved" &&
          pr.finance_verification_status === "pending" && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <svg
                  className="h-5 w-5 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Approved - Awaiting Finance Verification
                  </h3>
                  <p className="mt-1 text-sm text-blue-700">
                    {"Your PR has been approved! It's now with the Finance team for payment verification."}
                  </p>
                </div>
              </div>
            </div>
          )}

        {pr.finance_verification_status === "verified" && !pr.po_created && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <svg
                className="h-5 w-5 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Payment Verified
                </h3>
                <p className="mt-1 text-sm text-green-700">
                  Your PR has been fully approved and payment verified. The
                  Procurement team will create a Purchase Order soon.
                </p>
              </div>
            </div>
          </div>
        )}

        {pr.po_created && (
          <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex">
              <svg
                className="h-5 w-5 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-purple-800">
                  Purchase Order Created
                </h3>
                <p className="mt-1 text-sm text-purple-700">
                  A Purchase Order has been created for this PR. Check the PO
                  section for details.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
