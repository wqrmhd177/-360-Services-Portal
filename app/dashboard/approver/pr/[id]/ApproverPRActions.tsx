"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useReadOnlyAdmin } from "@/hooks/useReadOnlyAdmin";
import ActionConfirmModal from "@/components/ActionConfirmModal";

interface ApproverPRActionsProps {
  prId: string;
  redirectPath?: string;
  onSuccess?: () => void;
}

export default function ApproverPRActions({
  prId,
  redirectPath = "/dashboard/approver/pr",
  onSuccess,
}: ApproverPRActionsProps) {
  const router = useRouter();
  const readOnly = useReadOnlyAdmin();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approveRemarks, setApproveRemarks] = useState("");
  const [rejectRemarks, setRejectRemarks] = useState("");

  const handleSuccess = (param: string) => {
    if (onSuccess) {
      onSuccess();
      router.refresh();
    } else {
      router.push(redirectPath + (redirectPath.includes("?") ? "&" : "?") + param);
      router.refresh();
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/approver/pr/${prId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: approveRemarks }),
      });
      const data = await response.json();
      if (response.ok) {
        setShowApproveModal(false);
        handleSuccess("approved=true");
        return;
      }
      setError(data.error || "Failed to approve PR");
    } catch {
      setError("An unexpected error occurred");
    }
    setLoading(false);
  };

  const handleReject = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/approver/pr/${prId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectRemarks }),
      });
      const data = await response.json();
      if (response.ok) {
        setShowRejectModal(false);
        handleSuccess("rejected=true");
        return;
      }
      setError(data.error || "Failed to reject PR");
    } catch {
      setError("An unexpected error occurred");
    }
    setLoading(false);
  };

  if (readOnly) return null;

  return (
    <>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Approval Actions</h3>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowApproveModal(true)}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
          >
            Approve PR
          </button>
          <button
            type="button"
            onClick={() => setShowRejectModal(true)}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center"
          >
            Reject PR
          </button>
        </div>
      </div>

      <ActionConfirmModal
        open={showApproveModal}
        title="Approve Purchase Request"
        description="This will notify the Finance team. Please review the details before confirming."
        variant="approve"
        remarks={approveRemarks}
        onRemarksChange={setApproveRemarks}
        confirmLabel="Confirm Approval"
        loading={loading}
        onConfirm={handleApprove}
        onCancel={() => !loading && setShowApproveModal(false)}
      />

      <ActionConfirmModal
        open={showRejectModal}
        title="Reject Purchase Request"
        description="The PR creator will be notified of this rejection."
        variant="reject"
        remarks={rejectRemarks}
        onRemarksChange={setRejectRemarks}
        confirmLabel="Confirm Rejection"
        loading={loading}
        onConfirm={handleReject}
        onCancel={() => !loading && setShowRejectModal(false)}
      />
    </>
  );
}
