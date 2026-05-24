"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface ApproverPRActionsProps {
  prId: string;
  /** After approve/reject, redirect here. Default: /dashboard/approver/pr */
  redirectPath?: string;
  /** Called immediately on success (e.g. to close a parent modal). When provided, router.push is skipped. */
  onSuccess?: () => void;
}

export default function ApproverPRActions({ prId, redirectPath = "/dashboard/approver/pr", onSuccess }: ApproverPRActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const handleApprove = async () => {
    if (
      !confirm(
        "Are you sure you want to approve this PR? This action will notify the Finance team."
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/approver/pr/${prId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ remarks }),
      });

      const data = await response.json();

      if (response.ok) {
        if (onSuccess) {
          // Close the parent modal immediately, then refresh data in background
          onSuccess();
          router.refresh();
        } else {
          router.push(redirectPath + (redirectPath.includes("?") ? "&" : "?") + "approved=true");
          router.refresh();
        }
        // Keep loading=true so button stays disabled until modal closes / navigation happens
        return;
      } else {
        setError(data.error || "Failed to approve PR");
      }
    } catch (err) {
      console.error("Error approving PR:", err);
      setError("An unexpected error occurred");
    }
    setLoading(false);
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError("Rejection reason is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/approver/pr/${prId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowRejectModal(false);
        if (onSuccess) {
          onSuccess();
          router.refresh();
        } else {
          router.push(redirectPath + (redirectPath.includes("?") ? "&" : "?") + "rejected=true");
          router.refresh();
        }
        // Keep loading=true so button stays disabled until modal closes / navigation happens
        return;
      } else {
        setError(data.error || "Failed to reject PR");
      }
    } catch (err) {
      console.error("Error rejecting PR:", err);
      setError("An unexpected error occurred");
    }
    setLoading(false);
    setShowRejectModal(false);
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Approval Actions
        </h3>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Remarks (Optional for Approval) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Remarks (Optional)
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            disabled={loading}
            rows={3}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Add any comments or notes about this approval..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <svg
              className="w-5 h-5 mr-2"
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
            {loading ? "Processing..." : "Approve PR"}
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <svg
              className="w-5 h-5 mr-2"
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
            Reject PR
          </button>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => !loading && setShowRejectModal(false)}
            />

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Reject Purchase Request
                  </h3>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 text-left mb-2">
                      Rejection Reason{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      disabled={loading}
                      required
                      rows={4}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                      placeholder="Please provide a detailed reason for rejection..."
                    />
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  disabled={loading || !rejectionReason.trim()}
                  onClick={handleReject}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Rejecting..." : "Confirm Rejection"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowRejectModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
