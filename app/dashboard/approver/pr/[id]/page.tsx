import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import type { Pr } from "@/types/workflows";
import ApproverPRActions from "./ApproverPRActions";
import PRDetailCard from "@/components/PRDetailCard";
import Link from "next/link";

interface PageProps {
  params: {
    id: string;
  };
}

async function getPR(id: string) {
  const supabase = createSupabaseClient();

  const { data: pr } = await supabase
    .from("pr")
    .select("*")
    .eq("id", id)
    .single();

  return pr as Pr | null;
}

export default async function ApproverPRDetailPage({ params }: PageProps) {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  if (session.role !== "approver" && !session.isAdmin) {
    redirect("/dashboard");
  }

  const pr = await getPR(params.id);

  if (!pr) {
    redirect("/dashboard/approver/pr");
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">PR Details</h1>
            <p className="mt-1 text-sm text-gray-600">
              Review and approve/reject purchase request
            </p>
          </div>
          <Link
            href="/dashboard/approver/pr"
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

        {/* Approval Actions */}
        {pr.approval_status === "pending" && (
          <div className="mt-6">
            <ApproverPRActions prId={pr.id} />
          </div>
        )}

        {pr.approval_status === "approved" && (
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
                  PR Approved
                </h3>
                <p className="mt-1 text-sm text-green-700">
                  This PR has been approved and is awaiting Finance
                  verification.
                </p>
              </div>
            </div>
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
                <h3 className="text-sm font-medium text-red-800">
                  PR Rejected
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  This PR has been rejected. The Growth team can edit and
                  resubmit.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
