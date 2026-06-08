"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Pr } from "@/types/workflows";
import PRDetailCard from "@/components/PRDetailCard";
import { canEditGrowthPr, canReopenGrowthPr } from "@/lib/growthPrAccess";
import AdminCreatorFilter from "@/components/AdminCreatorFilter";
import { ListPageHeader } from "@/components/lists/ListPageHeader";
import { StatusFilterPills } from "@/components/lists/StatusFilterPills";
import { ListTableShell, ListEmptyState, ListSkeleton } from "@/components/lists/ListTableShell";
import PrListTable from "@/components/lists/PrListTable";
import { formatPrAmount, getPrSeller, summarizePrProduct } from "@/lib/format";

export default function GrowthPurchaseRequestsPage() {
  const router = useRouter();
  const [prs, setPrs] = useState<Pr[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<string>("");
  const [selectedPr, setSelectedPr] = useState<Pr | null>(null);

  useEffect(() => {
    loadPrs();
  }, [creatorFilter]);

  async function loadPrs() {
    setLoading(true);
    try {
      const params = creatorFilter ? `?createdBy=${encodeURIComponent(creatorFilter)}` : "";
      const res = await fetch(`/api/growth/prs${params}`);
      const data = await res.json().catch(() => null);
      setPrs(res.ok && Array.isArray(data) ? data : []);
    } catch {
      setPrs([]);
    } finally {
      setLoading(false);
    }
  }

  async function reopenPR(prId: string) {
    if (!confirm("Reopen this PR and send it back for approval?")) return;
    try {
      const res = await fetch(`/api/growth/pr/${prId}/reopen`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Failed to reopen PR");
        return;
      }
      await loadPrs();
      if (
        confirm(
          "PR reopened successfully. Open the edit page now to update details before it goes for approval?"
        )
      ) {
        router.push(data.editUrl || `/dashboard/growth/pr/${prId}/edit`);
      }
    } catch {
      alert("Failed to reopen PR");
    }
  }

  const safePrs = Array.isArray(prs) ? prs : [];
  const filteredPrs =
    statusFilter === "all"
      ? safePrs
      : statusFilter === "pending_approval"
      ? safePrs.filter((pr) => pr.approval_status === "pending")
      : statusFilter === "approved"
      ? safePrs.filter((pr) => pr.approval_status === "approved")
      : statusFilter === "finance_verified"
      ? safePrs.filter((pr) => pr.finance_verification_status === "verified")
      : statusFilter === "po_created"
      ? safePrs.filter((pr) => !!pr.po_created)
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
    const headers = ["PR Number", "Product", "Seller", "Amount", "Approval Status", "Finance Status", "PO Created", "Created At"];
    const rows = selected.map((pr) => [
      pr.pr_number || pr.id,
      summarizePrProduct(pr),
      getPrSeller(pr),
      formatPrAmount(pr),
      pr.approval_status,
      pr.finance_verification_status,
      pr.po_created ? "Yes" : "No",
      pr.created_at ? new Date(pr.created_at).toLocaleString() : "",
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
    pending_approval: safePrs.filter((p) => p.approval_status === "pending").length,
    approved: safePrs.filter((p) => p.approval_status === "approved").length,
    finance_verified: safePrs.filter((p) => p.finance_verification_status === "verified").length,
    po_created: safePrs.filter((p) => !!p.po_created).length,
  };

  const filterOptions = [
    { key: "all", label: "All", count: statusCounts.all },
    { key: "pending_approval", label: "Pending Approval", count: statusCounts.pending_approval },
    { key: "approved", label: "Approved", count: statusCounts.approved },
    { key: "finance_verified", label: "Finance Verified", count: statusCounts.finance_verified },
    { key: "po_created", label: "PO Created", count: statusCounts.po_created },
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
            <AdminCreatorFilter value={creatorFilter} onChange={setCreatorFilter} />
            <StatusFilterPills options={filterOptions} activeKey={statusFilter} onChange={setStatusFilter} />
          </>
        }
      />

      <ListTableShell>
        {loading ? (
          <table className="min-w-full"><ListSkeleton rows={6} cols={9} /></table>
        ) : filteredPrs.length === 0 ? (
          <ListEmptyState message="No purchase requests found." />
        ) : (
          <PrListTable
            prs={filteredPrs}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onSelectOne={handleSelectOne}
            onView={setSelectedPr}
            showPoCreated
            extraActions={(pr) => (
              <>
                {canEditGrowthPr(pr) && (
                  <Link
                    href={`/dashboard/growth/pr/${pr.id}/edit`}
                    className="text-xs font-medium text-blue-700 hover:text-blue-900"
                  >
                    Edit
                  </Link>
                )}
                {canReopenGrowthPr(pr) && (
                  <button
                    type="button"
                    onClick={() => reopenPR(pr.id)}
                    className="text-xs font-medium text-amber-700 hover:text-amber-900"
                  >
                    Reopen
                  </button>
                )}
              </>
            )}
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
              <button
                type="button"
                onClick={() => setSelectedPr(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <PRDetailCard pr={selectedPr} />
          </div>
        </div>
      )}
    </div>
  );
}
