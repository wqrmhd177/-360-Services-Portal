import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import type { Pr } from "@/types/workflows";
import PRDetailCard from "@/components/PRDetailCard";

interface PageProps {
  params: { id: string };
}

async function getPR(id: string) {
  const supabase = createSupabaseClient();
  const { data: pr } = await supabase.from("pr").select("*").eq("id", id).maybeSingle();
  return pr as Pr | null;
}

export default async function SearchPRViewPage({ params }: PageProps) {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const pr = await getPR(params.id);
  if (!pr) {
    return (
      <div className="space-y-6">
        <div className="card">
          <p className="text-sm text-gray-500">PR not found.</p>
          <Link href="/dashboard" className="mt-4 text-xs font-medium text-gray-900 hover:text-gray-700">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Purchase Request Details (View Only)</h1>
            <p className="mt-1 text-sm text-gray-600">
              {pr.pr_number && <span className="font-mono font-medium">{pr.pr_number}</span>}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        <PRDetailCard pr={pr} showFullDetails={true} />

        {pr.approval_status === "pending" && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-yellow-800">Pending Approval</h3>
            <p className="mt-1 text-sm text-yellow-700">This PR is awaiting approval from the Approver team.</p>
          </div>
        )}
        {pr.approval_status === "rejected" && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-red-800">PR Rejected</h3>
            <p className="mt-1 text-sm text-red-700">This PR has been rejected.</p>
          </div>
        )}
        {pr.approval_status === "approved" && pr.finance_verification_status === "pending" && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800">Approved – Awaiting Finance Verification</h3>
            <p className="mt-1 text-sm text-blue-700">PR has been approved; awaiting payment verification.</p>
          </div>
        )}
        {pr.finance_verification_status === "verified" && !pr.po_created && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-green-800">Payment Verified</h3>
            <p className="mt-1 text-sm text-green-700">PR approved and payment verified; PO creation pending.</p>
          </div>
        )}
        {pr.po_created && (
          <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-purple-800">Purchase Order Created</h3>
            <p className="mt-1 text-sm text-purple-700">A Purchase Order has been created for this PR.</p>
          </div>
        )}
      </div>
    </div>
  );
}
