"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Pr } from "@/types/workflows";
import PRDetailCard from "@/components/PRDetailCard";
import { ListPageHeader } from "@/components/lists/ListPageHeader";
import { StatusFilterPills } from "@/components/lists/StatusFilterPills";
import { ListTableShell, ListEmptyState, ListSkeleton } from "@/components/lists/ListTableShell";
import PrListTable from "@/components/lists/PrListTable";
import { formatPrAmount, getPrSeller, summarizePrProduct } from "@/lib/format";

export default function ProcurementPurchaseRequestsPage() {
  const [prs, setPrs] = useState<Pr[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPr, setSelectedPr] = useState<Pr | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPrs();
  }, []);

  async function loadPrs() {
    setLoading(true);
    try {
      const res = await fetch("/api/procurement/prs");
      const data = await res.json().catch(() => ({}));
      const list = data?.prs ?? data;
      setPrs(res.ok && Array.isArray(list) ? list : []);
    } catch {
      setPrs([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredPrs =
    statusFilter === "all"
      ? prs
      : statusFilter === "pending"
      ? prs.filter((pr) => pr.finance_verification_status === "pending")
      : statusFilter === "verified"
      ? prs.filter(
          (pr) =>
            pr.approval_status === "approved" &&
            pr.finance_verification_status === "verified" &&
            !pr.po_created
        )
      : statusFilter === "po_created"
      ? prs.filter((pr) => !!pr.po_created)
      : prs;

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
      pr.pr_number || "-",
      summarizePrProduct(pr),
      getPrSeller(pr),
      formatPrAmount(pr),
      pr.approval_status,
      pr.finance_verification_status,
      pr.po_created ? "Yes" : "No",
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
    all: prs.length,
    pending: prs.filter((p) => p.finance_verification_status === "pending").length,
    verified: prs.filter(
      (p) => p.approval_status === "approved" && p.finance_verification_status === "verified" && !p.po_created
    ).length,
    po_created: prs.filter((p) => !!p.po_created).length,
  };

  const filterOptions = [
    { key: "all", label: "All", count: statusCounts.all },
    { key: "pending", label: "Pending Verification", count: statusCounts.pending },
    { key: "verified", label: "Ready for PO", count: statusCounts.verified },
    { key: "po_created", label: "PO Created", count: statusCounts.po_created },
  ];

  const isReadyForPo = (pr: Pr) =>
    pr.approval_status === "approved" &&
    pr.finance_verification_status === "verified" &&
    !pr.po_created;

  return (
    <div className="space-y-6">
      <ListPageHeader
        title="Purchase Requests"
        actions={
          <button type="button" onClick={downloadCSV} className="btn-secondary">
            Download CSV ({selectedIds.size} selected)
          </button>
        }
        filters={
          <StatusFilterPills options={filterOptions} activeKey={statusFilter} onChange={setStatusFilter} />
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
            showPoCreated
            extraActions={(pr) =>
              isReadyForPo(pr) ? (
                <Link
                  href={`/dashboard/procurement/pr/${pr.id}/convert`}
                  className="rounded bg-green-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-green-700"
                >
                  Convert to PO
                </Link>
              ) : null
            }
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
              <h3 className="text-lg font-semibold text-gray-900">{selectedPr.pr_number || "Purchase Request"}</h3>
              <button type="button" onClick={() => setSelectedPr(null)} className="text-gray-400 hover:text-gray-600" aria-label="Close">✕</button>
            </div>
            <PRDetailCard pr={selectedPr} />
          </div>
        </div>
      )}
    </div>
  );
}
