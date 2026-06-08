"use client";

import { useState, useEffect } from "react";
import type { Pr } from "@/types/workflows";
import PRDetailCard from "@/components/PRDetailCard";
import ApproverPRActions from "./[id]/ApproverPRActions";
import CreatorFilterDropdown from "@/components/CreatorFilterDropdown";
import { ListPageHeader } from "@/components/lists/ListPageHeader";
import { StatusFilterPills } from "@/components/lists/StatusFilterPills";
import { ListTableShell, ListEmptyState, ListSkeleton } from "@/components/lists/ListTableShell";
import PrListTable from "@/components/lists/PrListTable";
import { formatPrAmount, getPrSeller, summarizePrProduct } from "@/lib/format";

export default function ApproverPurchaseRequestsPage() {
  const [prs, setPrs] = useState<Pr[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<string>("");
  const [selectedPr, setSelectedPr] = useState<Pr | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPrs();
  }, [creatorFilter]);

  async function loadPrs() {
    setLoading(true);
    try {
      const params = creatorFilter ? `?createdBy=${encodeURIComponent(creatorFilter)}` : "";
      const res = await fetch(`/api/approver/prs${params}`);
      const data = await res.json().catch(() => ({}));
      const list = data?.prs ?? data;
      setPrs(res.ok && Array.isArray(list) ? list : []);
    } catch {
      setPrs([]);
    } finally {
      setLoading(false);
    }
  }

  const safePrs = Array.isArray(prs) ? prs : [];
  const filteredPrs =
    statusFilter === "all"
      ? safePrs
      : statusFilter === "pending"
      ? safePrs.filter((pr) => pr.approval_status === "pending")
      : statusFilter === "approved"
      ? safePrs.filter((pr) => pr.approval_status === "approved")
      : statusFilter === "rejected"
      ? safePrs.filter((pr) => pr.approval_status === "rejected")
      : safePrs;

  function handleSelectAll() {
    setSelectedIds(
      selectedIds.size === filteredPrs.length
        ? new Set()
        : new Set(filteredPrs.map((pr) => pr.id))
    );
  }

  function handleSelectOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function downloadCSV() {
    const selected = filteredPrs.filter((pr) => selectedIds.has(pr.id));
    if (selected.length === 0) {
      alert("Please select at least one PR to download");
      return;
    }
    const headers = ["PR Number", "Product", "Seller", "Amount", "Approval Status", "Finance Status", "Created At"];
    const rows = selected.map((pr) => [
      pr.pr_number || "-",
      summarizePrProduct(pr),
      getPrSeller(pr),
      formatPrAmount(pr),
      pr.approval_status,
      pr.finance_verification_status,
      pr.created_at ? new Date(pr.created_at).toLocaleString() : "-",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `purchase-requests-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  }

  const statusCounts = {
    all: safePrs.length,
    pending: safePrs.filter((p) => p.approval_status === "pending").length,
    approved: safePrs.filter((p) => p.approval_status === "approved").length,
    rejected: safePrs.filter((p) => p.approval_status === "rejected").length,
  };

  const filterOptions = [
    { key: "all", label: "All", count: statusCounts.all },
    { key: "pending", label: "Pending", count: statusCounts.pending },
    { key: "approved", label: "Approved", count: statusCounts.approved },
    { key: "rejected", label: "Rejected", count: statusCounts.rejected },
  ];

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Purchase Request History"
        actions={
          <button type="button" onClick={downloadCSV} className="btn-secondary">
            Download CSV ({selectedIds.size} selected)
          </button>
        }
        filters={
          <>
            <CreatorFilterDropdown value={creatorFilter} onChange={setCreatorFilter} />
            <StatusFilterPills options={filterOptions} activeKey={statusFilter} onChange={setStatusFilter} />
          </>
        }
      />

      <ListTableShell>
        {loading ? (
          <table className="min-w-full"><ListSkeleton rows={6} cols={8} /></table>
        ) : filteredPrs.length === 0 ? (
          <ListEmptyState message="No purchase requests found." />
        ) : (
          <PrListTable
            prs={filteredPrs}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onSelectOne={handleSelectOne}
            onView={setSelectedPr}
          />
        )}
      </ListTableShell>

      {selectedPr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedPr(null)}
        >
          <div
            className="card max-h-[90vh] w-full max-w-3xl overflow-y-auto border-gray-200 bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedPr.pr_number || "Purchase Request"}
              </h3>
              <button type="button" onClick={() => setSelectedPr(null)} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                ✕
              </button>
            </div>
            <PRDetailCard pr={selectedPr} />
            {selectedPr.approval_status === "pending" && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <ApproverPRActions prId={selectedPr.id} onSuccess={() => { setSelectedPr(null); loadPrs(); }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
