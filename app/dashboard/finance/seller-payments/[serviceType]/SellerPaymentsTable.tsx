"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Pr } from "@/types/workflows";
import { Eye, X, FileText, ImageOff, CheckCircle, XCircle, BadgeCheck, Pencil, Check } from "lucide-react";
import PRDetailCard from "@/components/PRDetailCard";
import ApproverPRActions from "../../../approver/pr/[id]/ApproverPRActions";

interface SellerPaymentsTableProps {
  prs: Pr[];
  serviceType: string;
  nameMap: Record<string, string>;
}

interface ProofEntry {
  transactionId?: string | null;
  url?: string | null;
}

function getProofEntries(pr: Pr): ProofEntry[] {
  if (pr.payment_entries && pr.payment_entries.length > 0) {
    return pr.payment_entries.map((e) => ({
      transactionId: e.transaction_id,
      url: e.payment_proof_path,
    }));
  }
  return [
    {
      transactionId: pr.transaction_id ?? null,
      url: pr.payment_proof_path ?? null,
    },
  ];
}

function getTotalAmount(pr: Pr): { amount: number; currency: string } {
  if (pr.products && pr.products.length > 0) {
    return {
      amount: pr.products.reduce((sum, p) => sum + p.totalAmount, 0),
      currency: pr.products[0].currency,
    };
  }
  return { amount: pr.amount ?? 0, currency: "AED" };
}

function isPdf(url: string) {
  return url.toLowerCase().includes(".pdf");
}

export default function SellerPaymentsTable({
  prs,
  serviceType,
  nameMap,
}: SellerPaymentsTableProps) {
  const router = useRouter();
  const [proofPr, setProofPr] = useState<Pr | null>(null);
  const [detailPr, setDetailPr] = useState<Pr | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [revertError, setRevertError] = useState<string | null>(null);

  // Search filter
  const displayPrs = searchQuery.trim()
    ? prs.filter((pr) =>
        (pr.pr_number ?? "").toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : prs;

  function downloadCSV() {
    if (displayPrs.length === 0) {
      alert("No records to download.");
      return;
    }
    const headers = ["PR Number", "Channel Name", "Total Amount", "Payment Type", "Created By", "Approval", "Finance Status"];
    const rows = displayPrs.map((pr) => {
      const { amount, currency } = getTotalAmount(pr);
      const creatorName = nameMap[pr.created_by_email] ?? pr.created_by_email.split("@")[0];
      return [
        pr.pr_number || "-",
        pr.seller_channel_name || "-",
        `${currency} ${amount.toLocaleString()}`,
        pr.payment_method || "-",
        creatorName,
        pr.approval_status || "-",
        pr.finance_verification_status || "-",
      ];
    });
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `seller-payments-${serviceType.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Selectable PR groups
  const pendingPrs = prs.filter((pr) => pr.approval_status === "pending");
  const verifiablePrs = prs.filter(
    (pr) =>
      pr.approval_status === "approved" &&
      pr.finance_verification_status === "pending"
  );
  const actionablePrs = [...pendingPrs, ...verifiablePrs];

  // Checkbox selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const allActionableSelected =
    actionablePrs.length > 0 &&
    actionablePrs.every((pr) => selectedIds.has(pr.id));
  const someSelected = selectedIds.size > 0;
  const someActionableSelected = actionablePrs.some((pr) =>
    selectedIds.has(pr.id)
  );

  // Which selected PRs are pending-approval vs finance-pending
  const selectedPendingIds = Array.from(selectedIds).filter((id) =>
    pendingPrs.some((pr) => pr.id === id)
  );
  const selectedVerifiableIds = Array.from(selectedIds).filter((id) =>
    verifiablePrs.some((pr) => pr.id === id)
  );

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllActionable = () => {
    if (allActionableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(actionablePrs.map((pr) => pr.id)));
    }
  };

  // ── Inline remarks ───────────────────────────────────────────────────────
  // Local overrides so edits are reflected immediately without waiting for router.refresh()
  const [localRemarks, setLocalRemarks] = useState<Record<string, string>>({});
  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
  const [editingRemarkValue, setEditingRemarkValue] = useState("");
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [remarkError, setRemarkError] = useState<string | null>(null);

  const startEditRemark = (pr: Pr) => {
    setEditingRemarkId(pr.id);
    setEditingRemarkValue(localRemarks[pr.id] ?? pr.finance_remarks ?? "");
    setRemarkError(null);
  };

  const cancelEditRemark = () => {
    setEditingRemarkId(null);
    setEditingRemarkValue("");
    setRemarkError(null);
  };

  const saveRemark = async (prId: string) => {
    setRemarkSaving(true);
    setRemarkError(null);
    try {
      const res = await fetch(`/api/finance/pr/${prId}/remark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remark: editingRemarkValue }),
      });
      if (res.ok) {
        setLocalRemarks((prev) => ({ ...prev, [prId]: editingRemarkValue }));
        setEditingRemarkId(null);
        router.refresh();
      } else {
        const data = await res.json();
        setRemarkError(data.error || "Failed to save remark");
      }
    } catch {
      setRemarkError("An unexpected error occurred");
    } finally {
      setRemarkSaving(false);
    }
  };

  // ── Single-PR inline verify ──────────────────────────────────────────────
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const handleInlineVerify = async (prId: string) => {
    setVerifyingId(prId);
    setVerifyError(null);
    try {
      const res = await fetch(`/api/finance/pr/${prId}/verify`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        setVerifyError(data.error || "Failed to verify payment");
      }
    } catch {
      setVerifyError("An unexpected error occurred");
    } finally {
      setVerifyingId(null);
    }
  };

  const handleRevert = async (prId: string) => {
    setRevertingId(prId);
    setRevertError(null);
    try {
      const res = await fetch(`/api/finance/pr/${prId}/revert`, { method: "POST" });
      if (res.ok) {
        setDetailPr(null);
        router.refresh();
      } else {
        const data = await res.json();
        setRevertError(data.error || "Failed to revert decision");
      }
    } catch {
      setRevertError("An unexpected error occurred");
    } finally {
      setRevertingId(null);
    }
  };

  // ── Single-PR approve modal ──────────────────────────────────────────────
  const [approvePr, setApprovePr] = useState<Pr | null>(null);
  const [approveRemarks, setApproveRemarks] = useState("");
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // ── Single-PR reject modal ───────────────────────────────────────────────
  const [rejectPr, setRejectPr] = useState<Pr | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // ── Bulk approve modal ───────────────────────────────────────────────────
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkApproveRemarks, setBulkApproveRemarks] = useState("");
  const [bulkApproveLoading, setBulkApproveLoading] = useState(false);
  const [bulkApproveResult, setBulkApproveResult] = useState<{
    done: number;
    failed: number;
  } | null>(null);

  // ── Bulk reject modal ────────────────────────────────────────────────────
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [bulkRejectLoading, setBulkRejectLoading] = useState(false);
  const [bulkRejectError, setBulkRejectError] = useState<string | null>(null);
  const [bulkRejectResult, setBulkRejectResult] = useState<{
    done: number;
    failed: number;
  } | null>(null);

  // ── Bulk verify modal ────────────────────────────────────────────────────
  const [bulkVerifyOpen, setBulkVerifyOpen] = useState(false);
  const [bulkVerifyLoading, setBulkVerifyLoading] = useState(false);
  const [bulkVerifyAction, setBulkVerifyAction] = useState<"approve" | "reject" | null>(null);
  const [bulkVerifyReason, setBulkVerifyReason] = useState("");
  const [bulkVerifyReasonError, setBulkVerifyReasonError] = useState<string | null>(null);
  const [bulkVerifyResult, setBulkVerifyResult] = useState<{
    action: "approve" | "reject";
    done: number;
    failed: number;
  } | null>(null);

  const openApproveModal = (pr: Pr) => {
    setApprovePr(pr);
    setApproveRemarks("");
    setApproveError(null);
  };

  const openRejectModal = (pr: Pr) => {
    setRejectPr(pr);
    setRejectReason("");
    setRejectError(null);
  };

  const handleApprove = async () => {
    if (!approvePr) return;
    setApproveLoading(true);
    setApproveError(null);
    try {
      const res = await fetch(`/api/approver/pr/${approvePr.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: approveRemarks }),
      });
      const data = await res.json();
      if (res.ok) {
        setApprovePr(null);
        router.refresh();
      } else {
        setApproveError(data.error || "Failed to approve PR");
        setApproveLoading(false);
      }
    } catch {
      setApproveError("An unexpected error occurred");
      setApproveLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectPr) return;
    if (!rejectReason.trim()) {
      setRejectError("Rejection reason is required");
      return;
    }
    setRejectLoading(true);
    setRejectError(null);
    try {
      const res = await fetch(`/api/approver/pr/${rejectPr.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (res.ok) {
        setRejectPr(null);
        router.refresh();
      } else {
        setRejectError(data.error || "Failed to reject PR");
        setRejectLoading(false);
      }
    } catch {
      setRejectError("An unexpected error occurred");
      setRejectLoading(false);
    }
  };

  const handleBulkApprove = async () => {
    setBulkApproveLoading(true);
    setBulkApproveResult(null);
    let done = 0;
    let failed = 0;
    for (const id of selectedPendingIds) {
      try {
        const res = await fetch(`/api/approver/pr/${id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remarks: bulkApproveRemarks }),
        });
        if (res.ok) done++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setBulkApproveLoading(false);
    setBulkApproveResult({ done, failed });
    setSelectedIds(new Set());
    router.refresh();
  };

  const handleBulkReject = async () => {
    if (!bulkRejectReason.trim()) {
      setBulkRejectError("Rejection reason is required");
      return;
    }
    setBulkRejectLoading(true);
    setBulkRejectError(null);
    setBulkRejectResult(null);
    let done = 0;
    let failed = 0;
    for (const id of selectedPendingIds) {
      try {
        const res = await fetch(`/api/approver/pr/${id}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: bulkRejectReason }),
        });
        if (res.ok) done++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setBulkRejectLoading(false);
    setBulkRejectResult({ done, failed });
    setSelectedIds(new Set());
    router.refresh();
  };

  const handleBulkVerify = async (action: "approve" | "reject") => {
    if (action === "reject" && !bulkVerifyReason.trim()) {
      setBulkVerifyReasonError("Rejection reason is required");
      return;
    }
    setBulkVerifyAction(action);
    setBulkVerifyLoading(true);
    setBulkVerifyResult(null);
    let done = 0;
    let failed = 0;
    const endpoint = action === "approve" ? "verify" : "reject";
    for (const id of selectedVerifiableIds) {
      try {
        const res = await fetch(`/api/finance/pr/${id}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: bulkVerifyReason }),
        });
        if (res.ok) done++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setBulkVerifyLoading(false);
    setBulkVerifyResult({ action, done, failed });
    setSelectedIds(new Set());
    router.refresh();
  };

  // ── Single-PR inline finance reject ──────────────────────────────────────
  const [financeRejectPr, setFinanceRejectPr] = useState<Pr | null>(null);
  const [financeRejectReason, setFinanceRejectReason] = useState("");
  const [financeRejectLoading, setFinanceRejectLoading] = useState(false);
  const [financeRejectError, setFinanceRejectError] = useState<string | null>(null);

  const handleFinanceReject = async () => {
    if (!financeRejectPr) return;
    if (!financeRejectReason.trim()) {
      setFinanceRejectError("Rejection reason is required");
      return;
    }
    setFinanceRejectLoading(true);
    setFinanceRejectError(null);
    try {
      const res = await fetch(`/api/finance/pr/${financeRejectPr.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: financeRejectReason }),
      });
      if (res.ok) {
        setFinanceRejectPr(null);
        router.refresh();
      } else {
        const data = await res.json();
        setFinanceRejectError(data.error || "Failed to reject");
        setFinanceRejectLoading(false);
      }
    } catch {
      setFinanceRejectError("An unexpected error occurred");
      setFinanceRejectLoading(false);
    }
  };

  const proofEntries = proofPr ? getProofEntries(proofPr) : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
          Seller Payments Knocking off
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Service Type:{" "}
          <span className="font-medium text-gray-700">{serviceType}</span>
        </p>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Purchase Requests — {serviceType}
          </h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PR number…"
                className="pl-3 pr-7 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-portal-400 focus:border-portal-400 w-48"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button onClick={downloadCSV} className="btn-secondary text-sm px-4 py-2">
              Download CSV
            </button>
          </div>
        </div>

        {/* Inline verify error toast */}
        {verifyError && (
          <div className="mb-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
            <span>{verifyError}</span>
            <button
              type="button"
              onClick={() => setVerifyError(null)}
              className="ml-3 text-red-400 hover:text-red-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Bulk action bar */}
        {someSelected && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <span className="text-sm font-medium text-blue-800">
              {selectedIds.size} PR{selectedIds.size > 1 ? "s" : ""} selected
              {selectedPendingIds.length > 0 && selectedVerifiableIds.length > 0 && (
                <span className="ml-1 text-blue-600 font-normal text-xs">
                  ({selectedPendingIds.length} pending · {selectedVerifiableIds.length} for verification)
                </span>
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              {/* Verify — only when finance-pending PRs are selected */}
              {selectedVerifiableIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setBulkVerifyResult(null);
                    setBulkVerifyOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700"
                >
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Verify Selected ({selectedVerifiableIds.length})
                </button>
              )}
              {/* Approve / Reject — only when approval-pending PRs are selected */}
              {selectedPendingIds.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkApproveRemarks("");
                      setBulkApproveResult(null);
                      setBulkApproveOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Approve Selected ({selectedPendingIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkRejectReason("");
                      setBulkRejectResult(null);
                      setBulkRejectError(null);
                      setBulkRejectOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject Selected ({selectedPendingIds.length})
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {prs.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            No purchase requests found for this service type.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  {/* Select-all — selects all actionable (pending + verifiable) PRs */}
                  <th className="w-8 px-3 py-2.5 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={allActionableSelected}
                      ref={(el) => {
                        if (el)
                          el.indeterminate =
                            someActionableSelected && !allActionableSelected;
                      }}
                      onChange={toggleAllActionable}
                      disabled={actionablePrs.length === 0}
                      className="h-4 w-4 cursor-pointer rounded border-2 border-gray-400 bg-white accent-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
                      title="Select all actionable PRs"
                    />
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-center align-middle">
                    PR No
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-center align-middle">
                    Channel Name
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-center align-middle">
                    Total Amount
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-center align-middle">
                    Payment Type
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-center align-middle">
                    Payment Proof
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-center align-middle">
                    Created By
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-center align-middle">
                    Approval
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-center align-middle">
                    Finance Status
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-center align-middle">
                    Actions
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-center align-middle">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayPrs.map((pr) => {
                  const { amount, currency } = getTotalAmount(pr);
                  const entries = getProofEntries(pr);
                  const hasProof = entries.some((e) => !!e.url);
                  const creatorName =
                    nameMap[pr.created_by_email] ??
                    pr.created_by_email.split("@")[0];
                  const isPending = pr.approval_status === "pending";
                  const isVerifiable =
                    pr.approval_status === "approved" &&
                    pr.finance_verification_status === "pending";
                  const isSelectable = isPending || isVerifiable;

                  return (
                    <tr
                      key={pr.id}
                      className={`border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50 ${
                        selectedIds.has(pr.id) ? "bg-blue-50/50" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="w-8 px-3 py-2.5 text-center align-middle">
                        {isSelectable ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(pr.id)}
                            onChange={() => toggleOne(pr.id)}
                            className="h-4 w-4 cursor-pointer rounded border-2 border-gray-400 bg-white accent-blue-600"
                          />
                        ) : (
                          <span className="inline-block h-4 w-4" />
                        )}
                      </td>

                      {/* PR No */}
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono font-medium text-gray-900 text-center align-middle">
                        {pr.pr_number || "-"}
                      </td>

                      {/* Channel Name */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-gray-700 text-center align-middle">
                        {pr.seller_channel_name || "-"}
                      </td>

                      {/* Total Amount */}
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-900 text-center align-middle">
                        {currency}{" "}
                        {typeof amount === "number" ? amount.toFixed(2) : amount}
                      </td>

                      {/* Payment Type */}
                      <td className="whitespace-nowrap px-3 py-2.5 capitalize text-gray-700 text-center align-middle">
                        {pr.payment_type || pr.payment_method || "-"}
                      </td>

                      {/* Payment Proof */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-center align-middle">
                        {hasProof ? (
                          <button
                            type="button"
                            onClick={() => setProofPr(pr)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                            title="View payment proof"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                            <ImageOff className="h-3.5 w-3.5" />
                            No proof
                          </span>
                        )}
                      </td>

                      {/* Created By */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-gray-700 text-center align-middle">
                        {creatorName}
                      </td>

                      {/* Approval */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-center align-middle">
                        <span
                          className={`badge capitalize ${
                            pr.approval_status === "approved"
                              ? "border-green-500 bg-green-50 text-green-700"
                              : pr.approval_status === "rejected"
                                ? "border-red-500 bg-red-50 text-red-700"
                                : "border-yellow-500 bg-yellow-50 text-yellow-700"
                          }`}
                        >
                          {pr.approval_status ?? "pending"}
                        </span>
                      </td>

                      {/* Finance Status */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-center align-middle">
                        <span
                          className={`badge capitalize ${
                            pr.finance_verification_status === "verified"
                              ? "border-green-500 bg-green-50 text-green-700"
                              : pr.finance_verification_status === "rejected"
                                ? "border-red-500 bg-red-50 text-red-700"
                                : "border-gray-300 bg-gray-50 text-gray-700"
                          }`}
                        >
                          {pr.finance_verification_status ?? "pending"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => setDetailPr(pr)}
                          className="text-gray-500 transition-colors hover:text-gray-900"
                          title="View PR details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>

                      {/* Remarks */}
                      <td className="px-3 py-2.5 min-w-[200px] max-w-[280px] text-center align-middle">
                        {editingRemarkId === pr.id ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingRemarkValue}
                                onChange={(e) => setEditingRemarkValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveRemark(pr.id);
                                  if (e.key === "Escape") cancelEditRemark();
                                }}
                                disabled={remarkSaving}
                                autoFocus
                                placeholder="Add remark…"
                                className="flex-1 rounded border border-blue-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                              />
                              <button
                                type="button"
                                onClick={() => saveRemark(pr.id)}
                                disabled={remarkSaving}
                                title="Save"
                                className="rounded p-1 text-green-600 transition-colors hover:bg-green-50 disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditRemark}
                                disabled={remarkSaving}
                                title="Cancel"
                                className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 disabled:opacity-50"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {remarkError && (
                              <p className="text-xs text-red-600">{remarkError}</p>
                            )}
                          </div>
                        ) : (
                          <div className="group flex items-start gap-1.5">
                            <span className={`flex-1 text-xs leading-relaxed ${
                              (localRemarks[pr.id] ?? pr.finance_remarks)
                                ? "text-gray-800"
                                : "italic text-gray-400"
                            }`}>
                              {localRemarks[pr.id] ?? pr.finance_remarks ?? "Add remark…"}
                            </span>
                            <button
                              type="button"
                              onClick={() => startEditRemark(pr)}
                              title="Edit remark"
                              className="mt-0.5 shrink-0 rounded p-0.5 text-gray-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-600"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PR Detail Modal */}
      {detailPr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDetailPr(null)}
        >
          <div
            className="card mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto border-gray-200 bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                PR Details{" "}
                {detailPr.pr_number && (
                  <span className="font-mono text-sm text-gray-600">
                    ({detailPr.pr_number})
                  </span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setDetailPr(null)}
                className="text-gray-400 transition-colors hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <PRDetailCard pr={detailPr} showFullDetails />
            {detailPr.approval_status === "pending" && (
              <div className="mt-6">
                <ApproverPRActions
                  prId={detailPr.id}
                  redirectPath={`/dashboard/finance/seller-payments/${encodeURIComponent(serviceType)}`}
                  onSuccess={() => setDetailPr(null)}
                />
              </div>
            )}
            {detailPr.approval_status === "approved" &&
              detailPr.finance_verification_status === "pending" && (
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      await handleInlineVerify(detailPr.id);
                      setDetailPr(null);
                    }}
                    disabled={verifyingId === detailPr.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-teal-300 bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
                  >
                    <BadgeCheck className="h-4 w-4" />
                    {verifyingId === detailPr.id ? "Approving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDetailPr(null);
                      setFinanceRejectPr(detailPr);
                      setFinanceRejectReason("");
                      setFinanceRejectError(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              )}

            {/* Revert Decision — shown when finance has already verified or rejected */}
            {(detailPr.finance_verification_status === "verified" ||
              detailPr.finance_verification_status === "rejected") && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  {revertError && (
                    <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {revertError}
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      Finance status is currently{" "}
                      <span className="font-semibold capitalize">{detailPr.finance_verification_status}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevert(detailPr.id)}
                      disabled={revertingId === detailPr.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      {revertingId === detailPr.id ? "Reverting…" : "Revert Decision"}
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {approvePr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !approveLoading && setApprovePr(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Approve Purchase Request
                </h3>
                {approvePr.pr_number && (
                  <p className="mt-0.5 font-mono text-xs text-gray-500">
                    {approvePr.pr_number}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => !approveLoading && setApprovePr(null)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              {approveError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {approveError}
                </p>
              )}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">
                  Remarks{" "}
                  <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={approveRemarks}
                  onChange={(e) => setApproveRemarks(e.target.value)}
                  disabled={approveLoading}
                  rows={3}
                  placeholder="Add any comments about this approval..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400 disabled:opacity-50"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => !approveLoading && setApprovePr(null)}
                  disabled={approveLoading}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={approveLoading}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  {approveLoading ? "Approving…" : "Confirm Approval"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectPr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !rejectLoading && setRejectPr(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Reject Purchase Request
                </h3>
                {rejectPr.pr_number && (
                  <p className="mt-0.5 font-mono text-xs text-gray-500">
                    {rejectPr.pr_number}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => !rejectLoading && setRejectPr(null)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              {rejectError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {rejectError}
                </p>
              )}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    setRejectError(null);
                  }}
                  disabled={rejectLoading}
                  rows={3}
                  placeholder="Please provide a reason for rejection..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => !rejectLoading && setRejectPr(null)}
                  disabled={rejectLoading}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={rejectLoading || !rejectReason.trim()}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {rejectLoading ? "Rejecting…" : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Verify Modal */}
      {bulkVerifyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() =>
            !bulkVerifyLoading && !bulkVerifyResult && setBulkVerifyOpen(false)
          }
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Bulk Payment Action
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {selectedVerifiableIds.length} PR
                  {selectedVerifiableIds.length > 1 ? "s" : ""} selected
                </p>
              </div>
              {!bulkVerifyLoading && !bulkVerifyResult && (
                <button
                  type="button"
                  onClick={() => setBulkVerifyOpen(false)}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="space-y-4 p-5">
              {bulkVerifyResult ? (
                <div className="space-y-3 text-center">
                  <div className="text-2xl">
                    {bulkVerifyResult.failed === 0 ? "✅" : "⚠️"}
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {bulkVerifyResult.done}{" "}
                    {bulkVerifyResult.action === "approve"
                      ? "approved"
                      : "rejected"}
                    {bulkVerifyResult.failed > 0 &&
                      `, ${bulkVerifyResult.failed} failed`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setBulkVerifyOpen(false)}
                    className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Optional rejection reason — only shown while typing or if error */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-600">
                      Remarks / Rejection Reason{" "}
                      <span className="text-gray-400">
                        (required for reject)
                      </span>
                    </label>
                    <textarea
                      value={bulkVerifyReason}
                      onChange={(e) => {
                        setBulkVerifyReason(e.target.value);
                        setBulkVerifyReasonError(null);
                      }}
                      disabled={bulkVerifyLoading}
                      rows={3}
                      placeholder="Add remarks or rejection reason..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                    />
                    {bulkVerifyReasonError && (
                      <p className="text-xs text-red-600">
                        {bulkVerifyReasonError}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleBulkVerify("approve")}
                      disabled={bulkVerifyLoading}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {bulkVerifyLoading && bulkVerifyAction === "approve"
                        ? "Approving…"
                        : `Approve ${selectedVerifiableIds.length} PR${selectedVerifiableIds.length > 1 ? "s" : ""}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkVerify("reject")}
                      disabled={bulkVerifyLoading}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      {bulkVerifyLoading && bulkVerifyAction === "reject"
                        ? "Rejecting…"
                        : `Reject ${selectedVerifiableIds.length} PR${selectedVerifiableIds.length > 1 ? "s" : ""}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Approve Modal */}
      {bulkApproveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() =>
            !bulkApproveLoading && !bulkApproveResult && setBulkApproveOpen(false)
          }
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Bulk Approve PRs
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {selectedPendingIds.length} PR
                  {selectedPendingIds.length > 1 ? "s" : ""} will be approved
                </p>
              </div>
              {!bulkApproveLoading && !bulkApproveResult && (
                <button
                  type="button"
                  onClick={() => setBulkApproveOpen(false)}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="space-y-4 p-5">
              {bulkApproveResult ? (
                <div className="space-y-3 text-center">
                  <div className="text-2xl">
                    {bulkApproveResult.failed === 0 ? "✅" : "⚠️"}
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {bulkApproveResult.done} approved
                    {bulkApproveResult.failed > 0 &&
                      `, ${bulkApproveResult.failed} failed`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setBulkApproveOpen(false)}
                    className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-600">
                      Remarks{" "}
                      <span className="text-gray-400">(optional — applied to all)</span>
                    </label>
                    <textarea
                      value={bulkApproveRemarks}
                      onChange={(e) => setBulkApproveRemarks(e.target.value)}
                      disabled={bulkApproveLoading}
                      rows={3}
                      placeholder="Add any comments about these approvals..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400 disabled:opacity-50"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setBulkApproveOpen(false)}
                      disabled={bulkApproveLoading}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkApprove}
                      disabled={bulkApproveLoading}
                      className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                    >
                      {bulkApproveLoading
                        ? "Approving…"
                        : `Approve ${selectedPendingIds.length} PR${selectedPendingIds.length > 1 ? "s" : ""}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reject Modal */}
      {bulkRejectOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() =>
            !bulkRejectLoading && !bulkRejectResult && setBulkRejectOpen(false)
          }
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Bulk Reject PRs
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {selectedPendingIds.length} PR
                  {selectedPendingIds.length > 1 ? "s" : ""} will be rejected
                </p>
              </div>
              {!bulkRejectLoading && !bulkRejectResult && (
                <button
                  type="button"
                  onClick={() => setBulkRejectOpen(false)}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="space-y-4 p-5">
              {bulkRejectResult ? (
                <div className="space-y-3 text-center">
                  <div className="text-2xl">
                    {bulkRejectResult.failed === 0 ? "✅" : "⚠️"}
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {bulkRejectResult.done} rejected
                    {bulkRejectResult.failed > 0 &&
                      `, ${bulkRejectResult.failed} failed`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setBulkRejectOpen(false)}
                    className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  {bulkRejectError && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {bulkRejectError}
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-600">
                      Rejection Reason <span className="text-red-500">*</span>{" "}
                      <span className="text-gray-400">(applied to all)</span>
                    </label>
                    <textarea
                      value={bulkRejectReason}
                      onChange={(e) => {
                        setBulkRejectReason(e.target.value);
                        setBulkRejectError(null);
                      }}
                      disabled={bulkRejectLoading}
                      rows={3}
                      placeholder="Please provide a reason for rejection..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setBulkRejectOpen(false)}
                      disabled={bulkRejectLoading}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkReject}
                      disabled={bulkRejectLoading || !bulkRejectReason.trim()}
                      className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {bulkRejectLoading
                        ? "Rejecting…"
                        : `Reject ${selectedPendingIds.length} PR${selectedPendingIds.length > 1 ? "s" : ""}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finance Reject Modal (single PR) */}
      {financeRejectPr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !financeRejectLoading && setFinanceRejectPr(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Reject Payment
                </h3>
                {financeRejectPr.pr_number && (
                  <p className="mt-0.5 font-mono text-xs text-gray-500">
                    {financeRejectPr.pr_number}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => !financeRejectLoading && setFinanceRejectPr(null)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              {financeRejectError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {financeRejectError}
                </p>
              )}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={financeRejectReason}
                  onChange={(e) => {
                    setFinanceRejectReason(e.target.value);
                    setFinanceRejectError(null);
                  }}
                  disabled={financeRejectLoading}
                  rows={3}
                  placeholder="Please provide a reason for rejection..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => !financeRejectLoading && setFinanceRejectPr(null)}
                  disabled={financeRejectLoading}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinanceReject}
                  disabled={financeRejectLoading || !financeRejectReason.trim()}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {financeRejectLoading ? "Rejecting…" : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Proof Lightbox Modal */}
      {proofPr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setProofPr(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Payment Proof
                </h3>
                {proofPr.pr_number && (
                  <p className="mt-0.5 font-mono text-xs text-gray-500">
                    {proofPr.pr_number}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setProofPr(null)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              {proofEntries.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No payment proof attached.
                </p>
              ) : (
                <div className="space-y-6">
                  {proofEntries.map((entry, idx) => (
                    <div key={idx} className="space-y-2">
                      {proofEntries.length > 1 && (
                        <p className="text-xs font-medium text-gray-500">
                          Entry {idx + 1}
                          {entry.transactionId && (
                            <span className="ml-2 font-mono text-gray-700">
                              — Txn: {entry.transactionId}
                            </span>
                          )}
                        </p>
                      )}
                      {entry.url ? (
                        isPdf(entry.url) ? (
                          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <FileText className="h-8 w-8 shrink-0 text-red-500" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-gray-900">
                                Payment Proof (PDF)
                              </p>
                              <a
                                href={entry.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-block text-xs font-medium text-blue-600 hover:underline"
                              >
                                Open PDF ↗
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="overflow-hidden rounded-xl border border-gray-200">
                            <img
                              src={entry.url}
                              alt={`Payment proof ${idx + 1}`}
                              className="max-h-[50vh] w-full bg-gray-50 object-contain"
                            />
                            <div className="border-t border-gray-100 px-3 py-2 text-right">
                              <a
                                href={entry.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-blue-600 hover:underline"
                              >
                                Open full size ↗
                              </a>
                            </div>
                          </div>
                        )
                      ) : (
                        <p className="text-xs text-gray-400">
                          No file attached for this entry.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
