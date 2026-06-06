"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ActionConfirmModal from "@/components/ActionConfirmModal";

interface FinancePrVerifyActionsProps {
  prId: string;
}

export default function FinancePrVerifyActions({ prId }: FinancePrVerifyActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [verifyRemarks, setVerifyRemarks] = useState("");
  const [rejectRemarks, setRejectRemarks] = useState("");

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/pr/${prId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: verifyRemarks }),
      });
      if (res.ok) {
        router.push("/dashboard/finance");
        router.refresh();
        return;
      }
      const data = await res.json();
      setError(data.error || "Failed to verify payment");
    } catch {
      setError("An unexpected error occurred");
    }
    setLoading(false);
  };

  const handleReject = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/pr/${prId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectRemarks }),
      });
      if (res.ok) {
        router.push("/dashboard/finance");
        router.refresh();
        return;
      }
      const data = await res.json();
      setError(data.error || "Failed to reject payment");
    } catch {
      setError("An unexpected error occurred");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setShowVerifyModal(true)}
          disabled={loading}
          className="btn-primary"
        >
          Verify Payment
        </button>
        <button
          type="button"
          onClick={() => setShowRejectModal(true)}
          disabled={loading}
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
        >
          Reject Payment
        </button>
      </div>
      <p className="text-[11px] text-gray-400">
        Once verified, this PR will be available for Procurement to convert into a Purchase Order.
      </p>

      <ActionConfirmModal
        open={showVerifyModal}
        title="Verify Payment"
        description="Confirm that payment has been verified for this PR."
        variant="verify"
        remarks={verifyRemarks}
        onRemarksChange={setVerifyRemarks}
        confirmLabel="Confirm Verification"
        loading={loading}
        onConfirm={handleVerify}
        onCancel={() => !loading && setShowVerifyModal(false)}
      />

      <ActionConfirmModal
        open={showRejectModal}
        title="Reject Payment"
        description="The PR creator will be notified of this rejection."
        variant="reject"
        remarks={rejectRemarks}
        onRemarksChange={setRejectRemarks}
        confirmLabel="Confirm Rejection"
        loading={loading}
        onConfirm={handleReject}
        onCancel={() => !loading && setShowRejectModal(false)}
      />
    </div>
  );
}
